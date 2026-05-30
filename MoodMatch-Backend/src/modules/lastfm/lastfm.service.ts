import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MusicContextDto } from '../huggingface/dto/music-context.dto';

export interface LastfmTrack {
  name: string;
  artist: string;
}

/**
 * Last.fm acts as the MOOD/ACTIVITY recommendation engine.
 *
 * Last.fm's tag.getTopTracks returns real, popularity-ranked tracks for human
 * tags like "workout", "study", "reggaeton" or "chill" - which is exactly what
 * our AI extracts. Each track is then resolved to a playable Spotify entry.
 */
@Injectable()
export class LastfmService {
  private readonly logger = new Logger(LastfmService.name);
  private readonly apiKey?: string;
  private readonly baseUrl: string;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('lastfm.apiKey');
    this.baseUrl =
      this.config.get<string>('lastfm.apiBaseUrl') ||
      'https://ws.audioscrobbler.com/2.0/';
  }

  isConfigured(): boolean {
    return !!this.apiKey && this.apiKey !== 'your_lastfm_api_key_here';
  }

  /**
   * Returns top tracks matching the context.
   * 1. Picks a primary tag - genre-first when the user named a genre explicitly.
   * 2. Biases results toward the requested language when one was detected.
   */
  async getTopTracksByContext(
    context: MusicContextDto,
    limit = 100,
  ): Promise<{ tracks: LastfmTrack[]; tag: string }> {
    if (!this.isConfigured()) return { tracks: [], tag: '' };

    // 1. Pick the primary tag. candidateTags() is genre-first when the user
    //    named a genre explicitly, so the genre dominates instead of being a
    //    last resort behind activity/mood (the old bug).
    let primary: LastfmTrack[] = [];
    let usedTag = '';
    for (const tag of this.candidateTags(context)) {
      const tracks = await this.safeTracksByTag(tag, limit);
      if (tracks.length > 0) {
        primary = tracks;
        usedTag = tag;
        break;
      }
      this.logger.debug(`Last.fm tag "${tag}" returned 0 tracks`);
    }
    if (primary.length === 0) return { tracks: [], tag: '' };

    // 2. Apply the language strategy (no-op when language is 'any'/English).
    const langTags = this.languageTags(context);
    if (langTags.length === 0) {
      this.logger.log(`Last.fm tag "${usedTag}" -> ${primary.length} tracks`);
      return { tracks: primary, tag: usedTag };
    }

    // Build a pool of artists known for the requested language, then push
    // language-matching tracks to the front and backfill with the language
    // pool. This forces results toward the requested language even though
    // tag.gettoptracks only accepts one tag at a time.
    const langPoolNested = await Promise.all(
      langTags.map((t) => this.safeTracksByTag(t, limit)),
    );
    const langPool = this.dedupe(langPoolNested.flat());
    const langArtists = new Set(langPool.map((t) => t.artist.toLowerCase()));

    const matching = primary.filter((t) =>
      langArtists.has(t.artist.toLowerCase()),
    );
    const rest = primary.filter(
      (t) => !langArtists.has(t.artist.toLowerCase()),
    );
    const merged = this.dedupe([...matching, ...langPool, ...rest]);

    const finalTag = `${usedTag}+${context.language}`;
    this.logger.log(
      `Last.fm tag "${finalTag}" -> ${matching.length}/${primary.length} primary matched language, ${langPool.length} from lang tags, ${merged.length} total`,
    );
    return { tracks: merged, tag: finalTag };
  }

  /** tag.gettoptracks that never throws - returns [] on any failure. */
  private async safeTracksByTag(
    tag: string,
    limit: number,
  ): Promise<LastfmTrack[]> {
    try {
      return await this.getTopTracksByTag(tag, limit);
    } catch (e) {
      this.logger.warn(`Last.fm tag "${tag}" failed: ${e.message}`);
      return [];
    }
  }

  private dedupe(tracks: LastfmTrack[]): LastfmTrack[] {
    const seen = new Set<string>();
    return tracks.filter((t) => {
      const key = `${t.name.toLowerCase()}|${t.artist.toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  /** Representative Last.fm tags used to bias results toward a language. */
  private languageTags(context: MusicContextDto): string[] {
    const map: Record<string, string[]> = {
      es: ['latin', 'spanish', 'latin pop'],
      pt: ['brazilian', 'mpb', 'bossa nova'],
      en: [],
    };
    return map[context.language] || [];
  }

  private async getTopTracksByTag(
    tag: string,
    limit: number,
  ): Promise<LastfmTrack[]> {
    const url =
      `${this.baseUrl}?method=tag.gettoptracks` +
      `&tag=${encodeURIComponent(tag)}` +
      `&limit=${limit}` +
      `&api_key=${this.apiKey}` +
      `&format=json`;

    const res = await fetch(url, { signal: AbortSignal.timeout(12_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    if (data?.error) throw new Error(`Last.fm error ${data.error}: ${data.message}`);

    const raw: any[] = data?.tracks?.track || [];
    return raw
      .map((t) => ({
        name: t?.name as string,
        artist: (t?.artist?.name || t?.artist) as string,
      }))
      .filter((t) => t.name && t.artist);
  }

  /**
   * Ordered tags to try. When the user named a genre explicitly that genre
   * leads (dominant); otherwise activity/mood lead and genres add variety.
   */
  private candidateTags(context: MusicContextDto): string[] {
    const activityTag: Record<string, string> = {
      study: 'study',
      workout: 'workout',
      sleep: 'sleep',
      drive: 'driving',
      party: 'party',
      relax: 'relax',
      work: 'focus',
      meditate: 'meditation',
    };
    const moodTag: Record<string, string> = {
      calm: 'calm',
      energetic: 'energetic',
      happy: 'happy',
      sad: 'sad',
      romantic: 'romantic',
      focused: 'focus',
      chill: 'chill',
      aggressive: 'aggressive',
    };

    const tags: string[] = [];
    const genres = (context.genres || [])
      .filter(Boolean)
      .map((g) => g.toLowerCase());

    if (context.explicitGenre && genres.length) {
      // The user named a genre -> it dominates. Mood/activity only break ties.
      tags.push(...genres);
      if (context.mood && moodTag[context.mood]) tags.push(moodTag[context.mood]);
      if (context.activity && activityTag[context.activity]) tags.push(activityTag[context.activity]);
    } else {
      // No explicit genre -> activity/mood lead, detected genres add variety.
      if (context.activity && activityTag[context.activity]) tags.push(activityTag[context.activity]);
      if (context.mood && moodTag[context.mood]) tags.push(moodTag[context.mood]);
      tags.push(...genres);
    }

    return Array.from(new Set(tags));
  }
}
