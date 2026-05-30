import { Injectable, Logger } from '@nestjs/common';
import { HuggingFaceService } from '../huggingface/huggingface.service';
import { SpotifyService } from '../spotify/spotify.service';
import { LastfmService } from '../lastfm/lastfm.service';
import { MusicContextDto } from '../huggingface/dto/music-context.dto';
import { SpotifyTrackDto } from '../spotify/dto/spotify-track.dto';

/** How many tracks make up one page returned to the frontend. */
const PAGE_SIZE = 20;

export interface SearchResult {
  query: string;
  spotifyQuery: string;
  context: MusicContextDto;
  tracks: SpotifyTrackDto[];
  totalFound: number;
  hasMore: boolean;
  offset: number;
}

@Injectable()
export class MusicService {
  private readonly logger = new Logger(MusicService.name);

  constructor(
    private readonly huggingFaceService: HuggingFaceService,
    private readonly spotifyService: SpotifyService,
    private readonly lastfmService: LastfmService,
  ) {}

  /**
   * Main orchestration:
   * 1. Analyze query with HuggingFace (mood / activity / genres).
   * 2. PRIMARY: get mood/activity-matched tracks from Last.fm, resolved to
   *    playable Spotify entries.
   * 3. FALLBACK: Spotify genre fan-out if Last.fm isn't configured or yields
   *    nothing.
   */
  async searchByNaturalLanguage(
    query: string,
    offset = 0,
  ): Promise<SearchResult> {
    this.logger.log(`Processing search: "${query}" offset:${offset}`);

    const context = await this.huggingFaceService.analyzeText(query);
    this.logger.log(
      `Context: mood=${context.mood}, activity=${context.activity}, genres=${context.genres.join(',')}, lang=${context.language}`,
    );

    // ── PRIMARY: Last.fm mood/activity recommendations ──────────────────────
    if (this.lastfmService.isConfigured()) {
      try {
        const { tracks: lfTracks, tag } =
          await this.lastfmService.getTopTracksByContext(context, 150);

        if (lfTracks.length > 0) {
          // Paginate the Last.fm list, then resolve just this page on Spotify.
          const page = lfTracks.slice(offset, offset + PAGE_SIZE);
          const resolved = await this.spotifyService.resolveTracks(page);

          if (resolved.length > 0) {
            const hasMore = offset + PAGE_SIZE < lfTracks.length;
            this.logger.log(
              `Last.fm[${tag}] → ${resolved.length} playable tracks (hasMore: ${hasMore})`,
            );
            return {
              query,
              spotifyQuery: `lastfm:${tag}`,
              context,
              tracks: resolved,
              totalFound: resolved.length,
              hasMore,
              offset,
            };
          }
        }
      } catch (e) {
        this.logger.warn(`Last.fm path failed, falling back to Spotify: ${e.message}`);
      }
    } else {
      this.logger.debug('Last.fm not configured – using Spotify genre fan-out');
    }

    // ── FALLBACK: Spotify genre fan-out ─────────────────────────────────────
    const result = await this.spotifyService.searchTracks(context, offset);
    this.logger.log(
      `Spotify fan-out → ${result.tracks.length} tracks (hasMore: ${result.hasMore})`,
    );

    return {
      query,
      spotifyQuery: result.query,
      context,
      tracks: result.tracks,
      totalFound: result.tracks.length,
      hasMore: result.hasMore,
      offset,
    };
  }
}
