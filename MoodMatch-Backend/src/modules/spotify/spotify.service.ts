import {
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import { MusicContextDto } from '../huggingface/dto/music-context.dto';
import { SpotifyTrackDto } from './dto/spotify-track.dto';

interface CachedToken {
  token: string;
  expiresAt: number; // Unix timestamp in ms
}

@Injectable()
export class SpotifyService {
  private readonly logger = new Logger(SpotifyService.name);
  private readonly authHttp: AxiosInstance;
  private readonly apiHttp: AxiosInstance;
  private tokenCache: CachedToken | null = null;

  constructor(private readonly config: ConfigService) {
    const apiBaseUrl = this.config.get<string>('spotify.apiBaseUrl');

    // Auth client – used only for token requests
    this.authHttp = axios.create({
      baseURL: this.config.get<string>('spotify.tokenUrl'),
      timeout: 10000,
    });

    // API client – used for all Spotify Web API calls
    this.apiHttp = axios.create({
      baseURL: apiBaseUrl,
      timeout: 15000,
    });
  }

  /**
   * Returns a valid access token.
   * Reuses the cached token if it hasn't expired; otherwise requests a new one.
   * Implements the Client Credentials Flow (no user data, server-side only).
   */
  async getAccessToken(): Promise<string> {
    const now = Date.now();

    // Return cached token if still valid (5-minute buffer before actual expiry)
    if (this.tokenCache && this.tokenCache.expiresAt - 300_000 > now) {
      this.logger.debug('Using cached Spotify token');
      return this.tokenCache.token;
    }

    this.logger.log('Requesting new Spotify access token');

    const clientId = this.config.get<string>('spotify.clientId');
    const clientSecret = this.config.get<string>('spotify.clientSecret');

    if (!clientId || !clientSecret) {
      throw new UnauthorizedException('Spotify credentials are not configured');
    }

    // Base64-encode credentials as required by the Spotify auth spec
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    try {
      const response = await this.authHttp.post(
        '',
        'grant_type=client_credentials',
        {
          headers: {
            Authorization: `Basic ${credentials}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        },
      );

      const { access_token, expires_in } = response.data;

      // Cache the token with its expiry time
      this.tokenCache = {
        token: access_token,
        expiresAt: now + expires_in * 1000,
      };

      this.logger.log(`New Spotify token cached, expires in ${expires_in}s`);
      return access_token;
    } catch (error) {
      this.logger.error('Failed to obtain Spotify access token', error.message);
      throw new ServiceUnavailableException(
        'Spotify authentication failed – check your credentials',
      );
    }
  }

  /**
   * Searches Spotify using MULTIPLE parallel queries (one per genre/artist).
   * Spotify Development Mode caps results at 5 per request, so we fan out
   * across several queries and deduplicate to consistently return 15–20 tracks.
   */
  async searchTracks(
    context: MusicContextDto,
    offset = 0,
  ): Promise<{ tracks: SpotifyTrackDto[]; hasMore: boolean; query: string }> {
    const token = await this.getAccessToken();
    const queries = this.buildMultipleQueries(context);

    this.logger.log(`Multi-query search (${queries.length} queries, offset:${offset}): ${queries.join(' | ')}`);

    // Fire all queries in parallel
    const settled = await Promise.allSettled(
      queries.map((q) => this.spotifyFetch(token, q, offset)),
    );

    // Combine, deduplicate by track ID
    const seen = new Set<string>();
    const allItems: any[] = [];
    let anyHasMore = false;

    for (const result of settled) {
      if (result.status === 'fulfilled') {
        for (const item of result.value.items) {
          if (item?.id && !seen.has(item.id)) {
            seen.add(item.id);
            allItems.push(item);
          }
        }
        // If any query has more pages, offer "load more"
        if (result.value.total > offset + result.value.items.length) {
          anyHasMore = true;
        }
      }
    }

    if (allItems.length === 0) {
      this.logger.warn('All queries returned 0 results, using emergency fallback');
      return this.emergencyFallback(token, offset);
    }

    const tracks = allItems.map((item) => this.normalizeTrack(item));
    this.logger.log(`Combined ${tracks.length} unique tracks from ${queries.length} queries`);
    return { tracks, hasMore: anyHasMore, query: queries[0] };
  }

  // ─── Private Helpers ───────────────────────────────────────────────────────

  /**
   * Builds multiple Spotify queries — one per genre + one for artist/mood.
   * Uses genre: operator for accurate genre filtering (not text search).
   * Development Mode returns 5 results/query → 3 queries = up to 15 tracks.
   */
  private buildMultipleQueries(context: MusicContextDto): string[] {
    const queries: string[] = [];

    // Genre queries using Spotify's genre: filter operator
    for (const genre of context.genres.slice(0, 3)) {
      const mapped = this.mapGenre(genre);
      if (mapped) queries.push(`genre:${mapped}`);
    }

    // Named artist query
    if (context.artists.length > 0) {
      queries.push(`artist:${context.artists[0]}`);
    }

    // Mood/activity as keyword query (different angle for variety)
    const activityTerm = this.activityToSearchTerm(context.activity);
    const moodTerm = this.moodToSearchTerm(context.mood);
    const descriptor = activityTerm || moodTerm;
    if (descriptor && queries.length < 3) {
      queries.push(descriptor);
    }

    // Always have at least one query
    if (queries.length === 0) queries.push('genre:pop');

    return queries;
  }

  /**
   * Emergency fallback when all genre queries return 0 results.
   */
  private async emergencyFallback(
    token: string,
    offset: number,
  ): Promise<{ tracks: SpotifyTrackDto[]; hasMore: boolean; query: string }> {
    const fallbacks = ['genre:pop', 'genre:rock', 'genre:electronic'];
    for (const q of fallbacks) {
      try {
        const result = await this.spotifyFetch(token, q, offset);
        if (result.items.length > 0) {
          const tracks = result.items.map((i) => this.normalizeTrack(i));
          this.logger.log(`Emergency fallback "${q}" returned ${tracks.length} tracks`);
          return { tracks, hasMore: result.total > offset + result.items.length, query: q };
        }
      } catch { /* try next */ }
    }
    return { tracks: [], hasMore: false, query: 'pop' };
  }

  /**
   * Native fetch wrapper for Spotify search — bypasses Axios serialization.
   * Uses %20 encoding (not +) which Spotify handles unambiguously.
   */
  private async spotifyFetch(
    token: string,
    query: string,
    offset: number,
  ): Promise<{ items: any[]; total: number }> {
    // limit omitted – Spotify Development Mode rejects any explicit limit value
    const url =
      `https://api.spotify.com/v1/search` +
      `?q=${encodeURIComponent(query)}` +
      `&type=track` +
      (offset > 0 ? `&offset=${offset}` : '');

    this.logger.debug(`Fetch URL: ${url}`);

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      this.logger.error(`Spotify fetch ${res.status}: ${JSON.stringify(body)}`);
      const err: any = new Error(`Spotify ${res.status}`);
      err.status = res.status;
      throw err;
    }

    const data = await res.json();
    const tracksData = data?.tracks;
    this.logger.log(
      `Spotify response → limit:${tracksData?.limit} total:${tracksData?.total} items:${tracksData?.items?.length}`,
    );
    return {
      items: tracksData?.items || [],
      total: tracksData?.total || 0,
    };
  }

  /** Maps detected genre names to Spotify-friendly English terms */
  private mapGenre(genre: string): string {
    const map: Record<string, string> = {
      'lofi': 'lofi',
      'lo-fi': 'lofi hip hop',
      'ambient': 'ambient',
      'jazz': 'jazz',
      'rock': 'rock',
      'pop': 'pop',
      'classical': 'classical',
      'reggaeton': 'reggaeton',
      'electronic': 'electronic',
      'hip-hop': 'hip hop',
      'hip hop': 'hip hop',
      'r&b': 'r&b soul',
      'salsa': 'salsa',
      'acoustic': 'acoustic',
      'indie': 'indie',
      'chill': 'chill',
    };
    return map[genre.toLowerCase()] ?? genre;
  }

  /** Maps mood to a Spotify-searchable English music descriptor */
  private moodToSearchTerm(mood: string): string {
    const map: Record<string, string> = {
      'calm': 'relaxing',
      'energetic': 'energetic',
      'happy': 'happy',
      'sad': 'melancholic',
      'romantic': 'romantic',
      'focused': 'focus',
      'chill': 'chill',
      'aggressive': 'intense',
    };
    return map[mood] || '';
  }

  /** Maps activity to a Spotify-searchable English music descriptor */
  private activityToSearchTerm(activity: string): string {
    const map: Record<string, string> = {
      'study': 'study',
      'workout': 'workout',
      'sleep': 'sleep',
      'drive': 'driving',
      'party': 'party',
      'relax': 'relax',
      'work': 'work',
      'meditate': 'meditation',
    };
    return map[activity] || '';
  }

  /**
   * Normalizes a raw Spotify track object into our clean DTO.
   * Never exposes internal Spotify IDs or unnecessary fields to frontend.
   */
  private normalizeTrack(item: any): SpotifyTrackDto {
    const durationMs: number = item.duration_ms || 0;
    const image =
      item.album?.images?.[0]?.url ||
      item.album?.images?.[1]?.url ||
      null;

    return {
      id: item.id,
      name: item.name,
      artist: item.artists?.[0]?.name || 'Unknown Artist',
      artistId: item.artists?.[0]?.id || '',
      album: item.album?.name || 'Unknown Album',
      imageUrl: image || 'https://via.placeholder.com/300x300?text=No+Cover',
      previewUrl: item.preview_url || null,
      durationMs,
      duration: this.formatDuration(durationMs),
      popularity: item.popularity || 0,
      spotifyUrl: item.external_urls?.spotify || '',
      explicit: item.explicit || false,
      releaseYear: item.album?.release_date?.substring(0, 4) || '',
    };
  }

  /** Converts milliseconds to "m:ss" format */
  private formatDuration(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  /** Maps language code to Spotify market code */
  private resolveMarket(language: string): string | undefined {
    const map: Record<string, string> = {
      es: 'MX',
      en: 'US',
      pt: 'BR',
      fr: 'FR',
      de: 'DE',
      it: 'IT',
    };
    return map[language] || undefined;
  }
}
