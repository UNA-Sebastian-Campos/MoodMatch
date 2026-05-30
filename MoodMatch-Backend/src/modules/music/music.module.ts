import { Module } from '@nestjs/common';
import { MusicController } from './music.controller';
import { MusicService } from './music.service';
import { SpotifyModule } from '../spotify/spotify.module';
import { HuggingFaceModule } from '../huggingface/huggingface.module';
import { LastfmModule } from '../lastfm/lastfm.module';

@Module({
  imports: [SpotifyModule, HuggingFaceModule, LastfmModule],
  controllers: [MusicController],
  providers: [MusicService],
})
export class MusicModule {}
