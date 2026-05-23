import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'An unexpected error occurred';
    let errorCode = 'INTERNAL_ERROR';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object') {
        const obj = exceptionResponse as Record<string, any>;
        message = obj.message || message;
        errorCode = obj.error || errorCode;
      }
    } else if (exception instanceof Error) {
      // Map known external API errors
      if (exception.message.includes('Spotify')) {
        status = HttpStatus.BAD_GATEWAY;
        message = 'Spotify service is temporarily unavailable';
        errorCode = 'SPOTIFY_ERROR';
      } else if (exception.message.includes('Hugging Face') || exception.message.includes('HuggingFace')) {
        status = HttpStatus.BAD_GATEWAY;
        message = 'AI analysis service is temporarily unavailable';
        errorCode = 'AI_SERVICE_ERROR';
      } else if (exception.message.includes('Network') || exception.message.includes('ECONNREFUSED')) {
        status = HttpStatus.SERVICE_UNAVAILABLE;
        message = 'Network connectivity issue';
        errorCode = 'NETWORK_ERROR';
      }
    }

    // Log for internal visibility – never expose stack to client
    this.logger.error(
      `[${request.method}] ${request.url} → ${status}`,
      exception instanceof Error ? exception.stack : String(exception),
    );

    response.status(status).json({
      success: false,
      statusCode: status,
      errorCode,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
