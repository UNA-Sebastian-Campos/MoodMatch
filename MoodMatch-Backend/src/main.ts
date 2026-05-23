import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global prefix
  app.setGlobalPrefix('api');

  // CORS – whitelist localhost + any *.vercel.app subdomain + explicit FRONTEND_URL
  const explicitOrigin = (process.env.FRONTEND_URL || '').replace(/\/$/, '');
  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests without origin (Postman, Railway health checks, etc.)
      if (!origin) return callback(null, true);
      const allowed =
        origin === 'http://localhost:5173' ||
        origin === 'http://localhost:3000' ||
        origin.endsWith('.vercel.app') ||
        (explicitOrigin && origin === explicitOrigin);
      if (allowed) return callback(null, true);
      callback(new Error(`CORS blocked: ${origin}`));
    },
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: false,
  });

  // Global validation pipe – strips unknown fields, validates DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Global exception filter – standardizes error responses
  app.useGlobalFilters(new GlobalExceptionFilter());

  // Global response wrapper
  app.useGlobalInterceptors(new TransformInterceptor());

  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(`\n🎵  MoodMatch Backend running on http://localhost:${port}/api`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}\n`);
}

bootstrap();
