import { ExceptionFilter, Catch, ArgumentsHost, HttpException } from '@nestjs/common';
import { Request, Response } from 'express';
import { HttpExceptionResponse } from 'src/types/filter';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();

    let message = 'Internal server error';
    let error: unknown = null;

    const exceptionResponse = exception.getResponse();

    if (typeof exceptionResponse === 'string') {
      message = exceptionResponse;
    } else {
      const res = exceptionResponse as HttpExceptionResponse;
      message = res.message || message;
      error = res.error || null;
    }

    response.status(status).json({
      success: false,
      statusCode: status,
      message: message,
      error: error,
      path: request.url,
    });
  }
}
