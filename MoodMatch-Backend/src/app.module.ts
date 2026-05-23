import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import configuration from './config/configuration';
import { MusicModule } from './modules/music/music.module';
import { SpotifyModule } from './modules/spotify/spotify.module';
import { HuggingFaceModule } from './modules/huggingface/huggingface.module';

@Module({
  imports: [
    // Configuration – loads .env variables globally
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: '.env',
    }),

    // Rate limiting – 30 requests per minute per IP
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 30,
      },
    ]),

    // Feature modules
    SpotifyModule,
    HuggingFaceModule,
    MusicModule,
  ],
})
export class AppModule {}
