import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { MusicService, SearchResult } from './music.service';
import { SearchMusicDto } from './dto/search-music.dto';

@Controller('music')
@UseGuards(ThrottlerGuard)
export class MusicController {
  constructor(private readonly musicService: MusicService) {}

  /**
   * POST /api/music/search
   * Body: { query: string, offset?: number }
   *
   * offset=0  → first page (up to 50 tracks)
   * offset=50 → second page ("Load more")
   */
  @Post('search')
  @HttpCode(HttpStatus.OK)
  async search(@Body() dto: SearchMusicDto): Promise<SearchResult> {
    return this.musicService.searchByNaturalLanguage(
      dto.query,
      dto.offset ?? 0,
    );
  }
}
