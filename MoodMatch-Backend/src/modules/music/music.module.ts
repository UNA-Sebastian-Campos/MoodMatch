import { Module } from '@nestjs/common';
import { MusicController } from './music.controller';
import { MusicService } from './music.service';
import { SpotifyModule } from '../spotify/spotify.module';
import { HuggingFaceModule } from '../huggingface/huggingface.module';

@Module({
  imports: [SpotifyModule, HuggingFaceModule],
  controllers: [MusicController],
  providers: [MusicService],
})
export class MusicModule {}
