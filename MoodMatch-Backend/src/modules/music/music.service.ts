import { Injectable, Logger } from '@nestjs/common';
import { HuggingFaceService } from '../huggingface/huggingface.service';
import { SpotifyService } from '../spotify/spotify.service';
import { MusicContextDto } from '../huggingface/dto/music-context.dto';
import { SpotifyTrackDto } from '../spotify/dto/spotify-track.dto';

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
  ) {}

  /**
   * Main orchestration:
   * 1. Analyze query with HuggingFace (or rule-based fallback)
   * 2. Search Spotify with the extracted context
   * 3. Return normalized result with pagination info
   */
  async searchByNaturalLanguage(
    query: string,
    offset = 0,
  ): Promise<SearchResult> {
    this.logger.log(`Processing search: "${query}" offset:${offset}`);

    const context = await this.huggingFaceService.analyzeText(query);
    this.logger.log(
      `Context: mood=${context.mood}, genres=${context.genres.join(',')}, lang=${context.language}`,
    );

    const result = await this.spotifyService.searchTracks(context, offset);

    this.logger.log(
      `Found ${result.tracks.length} tracks (hasMore: ${result.hasMore})`,
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
