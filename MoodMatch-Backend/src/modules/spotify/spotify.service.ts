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
   * Resolves a list of {name, artist} pairs (e.g. from Last.fm) into playable
   * Spotify tracks. One /search?type=track call per item, run concurrently,
   * deduplicated by track ID. Items that can't be matched are skipped.
   */
  async resolveTracks(
    items: { name: string; artist: string }[],
  ): Promise<SpotifyTrackDto[]> {
    if (items.length === 0) return [];
    const token = await this.getAccessToken();

    const settled = await Promise.allSettled(
      items.map((it) => this.resolveOne(token, it.name, it.artist)),
    );

    const seen = new Set<string>();
    const out: SpotifyTrackDto[] = [];
    for (const r of settled) {
      if (r.status !== 'fulfilled' || !r.value) continue;
      if (seen.has(r.value.id)) continue;
      seen.add(r.value.id);
      out.push(r.value);
    }
    this.logger.log(`Resolved ${out.length}/${items.length} Last.fm tracks on Spotify`);
    return out;
  }

  /** Finds the best Spotify match for a single track name + artist. */
  private async resolveOne(
    token: string,
    name: string,
    artist: string,
  ): Promise<SpotifyTrackDto | null> {
    try {
      const q = `track:${name} artist:${artist}`;
      const { items } = await this.spotifyFetch(token, q, 0);
      const match = items.find(
        (t: any) => t?.id && t.duration_ms >= 60000 && t.duration_ms <= 900000,
      );
      return match ? this.normalizeTrack(match) : null;
    } catch (e) {
      this.logger.debug(`Resolve failed for "${name} – ${artist}": ${e.message}`);
      return null;
    }
  }

  async searchTracks(
    context: MusicContextDto,
    offset = 0,
  ): Promise<{ tracks: SpotifyTrackDto[]; hasMore: boolean; query: string }> {
    const token = await this.getAccessToken();

    // NOTE on strategy: Spotify Development Mode (and the Nov-2024 API
    // deprecations) block playlist-track access and /v1/artists with 403, and
    // cap /search at 5 results per query with no `limit` param. So the only
    // reliable building block is /search?type=track. We work around the cap by
    // fanning out many varied, mood-compatible queries and merging them.
    const fanout = await this.genreFanout(token, context, offset);
    if (fanout.tracks.length > 0) return fanout;

    this.logger.warn('Fan-out produced no tracks, using emergency fallback');
    return this.emergencyFallback(token, offset);
  }

  /**
   * Searches public, user-curated playlists matching the mood/activity and
   * returns tracks from the best-matching playlist that is actually readable.
   *
   * Resilience details:
   *  - Skips playlists owned by `spotify` (editorial → 403 in Development Mode).
   *  - Tries several playlist candidates until one returns tracks.
   *  - Uses `offset` to rotate which playlist is used, so "Load more" surfaces
   *    a different curated list instead of repeating tracks.
   */
  private async searchViaCuratedPlaylists(
    token: string,
    context: MusicContextDto,
    offset: number,
  ): Promise<{ tracks: SpotifyTrackDto[]; hasMore: boolean; query: string }> {
    const query = this.buildPlaylistQuery(context);
    this.logger.log(`Searching playlists with: "${query}"`);

    // type=playlist search (no `limit` param — Development Mode can reject it)
    const searchUrl =
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=playlist`;
    const searchRes = await fetch(searchUrl, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(15_000),
    });
    if (!searchRes.ok) throw new Error(`Playlist search ${searchRes.status}`);

    const searchData = await searchRes.json();
    const playlists: any[] = (searchData?.playlists?.items || [])
      .filter(Boolean)
      // Editorial/algorithmic playlists owned by Spotify are blocked (403).
      .filter((p: any) => (p?.owner?.id || '').toLowerCase() !== 'spotify')
      .filter((p: any) => (p?.tracks?.total || 0) >= 10);

    if (playlists.length === 0) throw new Error('No usable playlists found');

    // Rotate the starting playlist by page so "Load more" gives a new list.
    const pageIdx = Math.floor(offset / 50);
    const start = pageIdx % playlists.length;

    for (let k = 0; k < playlists.length; k++) {
      const pl = playlists[(start + k) % playlists.length];
      try {
        const tracks = await this.fetchPlaylistTracks(token, pl, context);
        if (tracks.length >= 5) {
          this.shuffle(tracks);
          const hasMore = playlists.length > 1 || (pl?.tracks?.total || 0) > 50;
          return { tracks, hasMore, query: `playlist:${pl.name}` };
        }
      } catch (e) {
        this.logger.warn(
          `Playlist "${pl?.name}" (${pl?.id}) unreadable: ${e.message} — trying next`,
        );
      }
    }

    throw new Error('All candidate playlists were unreadable');
  }

  /** Reads, cleans and audience-filters the tracks of a single playlist. */
  private async fetchPlaylistTracks(
    token: string,
    playlist: any,
    context: MusicContextDto,
  ): Promise<SpotifyTrackDto[]> {
    // `market` is required for track relinking under Client Credentials and
    // helps avoid 403/empty responses. No `limit` param (Dev Mode safe).
    const market = this.resolveMarket(context.language) || 'US';
    const url =
      `https://api.spotify.com/v1/playlists/${playlist.id}/tracks?market=${market}`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`tracks ${res.status}`);

    const data = await res.json();
    const seen = new Set<string>();
    const raw: any[] = (data?.items || [])
      .map((i: any) => i?.track)
      .filter((t: any) => {
        if (!t?.id || seen.has(t.id)) return false;
        if (t.duration_ms < 90000 || t.duration_ms > 600000) return false;
        seen.add(t.id);
        return true;
      });

    // Keep only tracks whose artist has a real audience (>= 5000 followers,
    // the closest proxy to "monthly listeners" the public API exposes).
    const popular = await this.filterByArtistAudience(token, raw, 5000);
    return popular.map((t) => this.normalizeTrack(t));
  }

  /**
   * Mood-aware genre fan-out (fallback when no curated playlist is usable).
   * Only queries genres compatible with the detected mood, with deterministic
   * pagination so "Load more" never repeats tracks.
   */
  private async genreFanout(
    token: string,
    context: MusicContextDto,
    offset: number,
  ): Promise<{ tracks: SpotifyTrackDto[]; hasMore: boolean; query: string }> {
    const queries = this.buildExpandedQueries(context);
    this.logger.log(`Genre fan-out queries (${queries.length}): ${queries.join(' | ')}`);

    const seen = new Set<string>();
    const candidates: any[] = [];
    let anyMore = false;

    for (const q of queries) {
      try {
        const result = await this.spotifyFetch(token, q, offset);
        if (result.total > offset + result.items.length) anyMore = true;
        for (const item of result.items) {
          if (!item?.id || seen.has(item.id)) continue;
          if (item.duration_ms < 90000 || item.duration_ms > 600000) continue;
          seen.add(item.id);
          candidates.push(item);
        }
      } catch (e) {
        this.logger.warn(`Query "${q}" failed: ${e.message}`);
      }
    }

    // Audience proxy WITHOUT extra API calls: every search track already carries
    // a `popularity` (0-100) field. /v1/artists is blocked (403), so we use this
    // instead of follower counts. Filter to reasonably popular tracks, but never
    // filter down to nothing — relax the threshold if too few survive.
    let popular = candidates.filter((t) => (t.popularity || 0) >= 35);
    if (popular.length < 8) popular = candidates.filter((t) => (t.popularity || 0) >= 20);
    if (popular.length < 5) popular = candidates;

    popular.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
    const tracks = popular.map((t) => this.normalizeTrack(t));
    this.shuffle(tracks);
    this.logger.log(
      `Fan-out: ${candidates.length} candidates → ${tracks.length} after popularity filter`,
    );
    return { tracks, hasMore: anyMore, query: queries.join(', ') };
  }

  /**
   * Builds a WIDE set of mood-compatible queries to beat Development Mode's
   * 5-results-per-query cap. For each compatible genre we add the bare
   * `genre:X` query plus a couple of year-windowed variants, which Spotify
   * treats as different result sets — yielding far more (and more varied)
   * tracks once merged.
   */
  private buildExpandedQueries(context: MusicContextDto): string[] {
    const allowed = this.compatibleGenresForMood(context.mood);

    // Genres detected by the AI that fit the mood; else the mood's defaults.
    let genres = context.genres
      .map((g) => this.mapGenre(g))
      .filter((g): g is string => !!g && allowed.includes(g));
    if (genres.length === 0) genres = allowed.slice(0, 4);
    genres = Array.from(new Set(genres)).slice(0, 4);

    const yearWindows = ['', ' year:2015-2026', ' year:2000-2014'];
    const queries: string[] = [];
    for (const g of genres) {
      for (const yw of yearWindows) {
        queries.push(`genre:${g}${yw}`);
      }
    }
    return queries;
  }

  /**
   * Builds `genre:` queries restricted to genres that fit the detected mood.
   * Falls back to a sensible default genre set for the mood when the detected
   * genres don't fit (or none were detected).
   */
  private buildMoodAwareQueries(context: MusicContextDto): string[] {
    const allowed = this.compatibleGenresForMood(context.mood);

    // Genres detected by the AI that are also mood-compatible.
    let chosen = context.genres
      .map((g) => this.mapGenre(g))
      .filter((g): g is string => !!g && allowed.includes(g));

    // If nothing detected fits the mood, use the mood's default genres.
    if (chosen.length === 0) chosen = allowed.slice(0, 3);

    // Deduplicate while preserving order, cap at 3 queries.
    const unique = Array.from(new Set(chosen)).slice(0, 3);
    return unique.map((g) => `genre:${g}`);
  }

  /** Genres (as Spotify seed identifiers) that fit each mood. */
  private compatibleGenresForMood(mood: string): string[] {
    const map: Record<string, string[]> = {
      calm:      ['ambient', 'classical', 'jazz', 'acoustic', 'chill', 'soul'],
      focused:   ['ambient', 'classical', 'chill', 'jazz', 'acoustic'],
      chill:     ['chill', 'jazz', 'indie', 'acoustic', 'ambient', 'soul'],
      sad:       ['acoustic', 'indie', 'blues', 'classical', 'soul', 'jazz'],
      romantic:  ['r-n-b', 'soul', 'jazz', 'acoustic', 'pop'],
      happy:     ['pop', 'funk', 'indie', 'reggaeton', 'salsa', 'soul'],
      energetic: ['rock', 'electronic', 'hip-hop', 'pop', 'metal', 'funk', 'reggaeton'],
      aggressive:['metal', 'rock', 'hip-hop', 'electronic'],
    };
    // Default to a broad, neutral set if the mood is unknown.
    return map[mood] || ['pop', 'indie', 'electronic'];
  }

  /**
   * Filters tracks by their main artist's follower count.
   * Fetches artists in batches of 50 via /v1/artists?ids= (one call per batch).
   */
  private async filterByArtistAudience(
    token: string,
    items: any[],
    minFollowers: number,
  ): Promise<any[]> {
    const ids = Array.from(
      new Set(items.map((t) => t?.artists?.[0]?.id).filter(Boolean)),
    );
    if (ids.length === 0) return items;

    const followers = new Map<string, number>();
    for (let i = 0; i < ids.length; i += 50) {
      const batch = ids.slice(i, i + 50);
      try {
        const res = await fetch(
          `https://api.spotify.com/v1/artists?ids=${batch.join(',')}`,
          {
            headers: { Authorization: `Bearer ${token}` },
            signal: AbortSignal.timeout(15_000),
          },
        );
        if (!res.ok) {
          this.logger.warn(`Artist lookup ${res.status} – skipping audience filter for batch`);
          continue;
        }
        const data = await res.json();
        for (const a of data?.artists || []) {
          if (a?.id) followers.set(a.id, a?.followers?.total ?? 0);
        }
      } catch (e) {
        this.logger.warn(`Artist lookup failed: ${e.message}`);
      }
    }

    // If the lookup yielded nothing (e.g. all calls failed), don't drop everything.
    if (followers.size === 0) return items;

    return items.filter((t) => {
      const id = t?.artists?.[0]?.id;
      // Keep tracks whose artist we couldn't resolve rather than discarding them.
      if (!id || !followers.has(id)) return true;
      return (followers.get(id) ?? 0) >= minFollowers;
    });
  }

  /** In-place Fisher-Yates shuffle */
  private shuffle<T>(arr: T[]): void {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }

  // ─── Private Helpers ───────────────────────────────────────────────────────

  /**
   * Builds the text query used to find curated playlists.
   * Combines a mood-compatible genre + the activity + a mood descriptor, e.g.
   * "ambient study focus" or "rock workout gym energy". This biases results
   * toward playlists that genuinely match the requested vibe.
   */
  private buildPlaylistQuery(context: MusicContextDto): string {
    const activityTerms: Record<string, string> = {
      study:    'study focus',
      workout:  'workout gym',
      sleep:    'sleep relax',
      drive:    'driving road trip',
      party:    'party hits',
      relax:    'chill relax',
      work:     'work focus productivity',
      meditate: 'meditation zen',
    };

    const moodTerms: Record<string, string> = {
      calm:      'calm',
      energetic: 'energy',
      happy:     'feel good',
      sad:       'emotional',
      romantic:  'romantic',
      focused:   'focus',
      chill:     'chill',
      aggressive:'intense',
    };

    const activity = activityTerms[context.activity] || context.activity || '';
    const mood = moodTerms[context.mood] || '';

    // Pick a genre that actually fits the mood (not whatever the AI guessed).
    const allowed = this.compatibleGenresForMood(context.mood);
    const detected = context.genres
      .map((g) => this.mapGenre(g))
      .find((g): g is string => !!g && allowed.includes(g));
    const genre = detected || allowed[0] || '';

    const parts = [genre, activity, mood].filter(Boolean);
    return parts.join(' ').trim() || 'music';
  }

  private async keywordSearch(
    token: string,
    context: MusicContextDto,
    offset: number,
  ): Promise<SpotifyTrackDto[]> {
    const query = this.buildPlaylistQuery(context);
    const url = `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=20` +
      (offset > 0 ? `&offset=${offset}` : '');

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) throw new Error(`Keyword search ${res.status}`);

    const data = await res.json();
    const items: any[] = (data?.tracks?.items || []).filter((t: any) =>
      t?.id &&
      t.duration_ms >= 90000 &&
      t.duration_ms <= 600000 &&
      (t.popularity || 0) >= 25
    );

    items.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
    return items.slice(0, 20).map(t => this.normalizeTrack(t));
  }

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
        const fbOffset = offset > 0 ? offset : Math.floor(Math.random() * 50);
        const result = await this.spotifyFetch(token, q, fbOffset);
        if (result.items.length > 0) {
          const tracks = result.items.map((i) => this.normalizeTrack(i));
          this.logger.log(`Emergency fallback "${q}" returned ${tracks.length} tracks`);
          return { tracks, hasMore: result.total > fbOffset + result.items.length, query: q };
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
    const tracksData = data?.tracks; // search response payload
    this.logger.log(
      `Spotify response → limit:${tracksData?.limit} total:${tracksData?.total} items:${tracksData?.items?.length}`,
    );
    return {
      items: tracksData?.items || [],
      total: tracksData?.total || 0,
    };
  }

  /** Maps detected genre names to Spotify's approved seed genre identifiers */
  private mapGenre(genre: string): string | null {
    // Only genres from Spotify's /v1/recommendations/available-genre-seeds
    const VALID_SEEDS: Record<string, string> = {
      'lofi':       'chill',
      'lo-fi':      'chill',
      'ambient':    'ambient',
      'jazz':       'jazz',
      'rock':       'rock',
      'pop':        'pop',
      'classical':  'classical',
      'reggaeton':  'reggaeton',
      'electronic': 'electronic',
      'hip-hop':    'hip-hop',
      'hip hop':    'hip-hop',
      'r&b':        'r-n-b',
      'rnb':        'r-n-b',
      'salsa':      'salsa',
      'acoustic':   'acoustic',
      'indie':      'indie',
      'indie pop':  'indie-pop',
      'metal':      'metal',
      'blues':      'blues',
      'funk':       'funk',
      'bossa nova': 'bossa-nova',
      'chill':      'chill',
      'trap':       'hip-hop',
      'soul':       'soul',
    };
    return VALID_SEEDS[genre.toLowerCase()] ?? null;
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
