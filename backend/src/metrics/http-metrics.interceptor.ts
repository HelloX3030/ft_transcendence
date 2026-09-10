import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import type { Request as ExpressRequest, Response as ExpressResponse } from 'express';
import { Observable } from 'rxjs';
import { MetricsService } from './metrics.service';

/**
 * Times every controller-handled HTTP request.
 *
 * The measurement is closed from the response's own lifecycle events, not from
 * the observable: an exception leaves `next.handle()` before the exception
 * filters have mapped it, so the status code is not final yet at that point.
 * Waiting for `finish`/`close` records what the client actually received.
 *
 * Requests that never match a route do not reach an interceptor at all, so 404s
 * from unknown paths are not counted here. That is deliberate as much as it is
 * incidental: labelling scanner traffic by its raw path is how a metrics
 * endpoint turns into an out-of-memory.
 */
@Injectable()
export class HttpMetricsInterceptor implements NestInterceptor {
  constructor(private readonly metrics: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    // Gateways and scheduled jobs share the interceptor chain but have no
    // request/response pair to measure.
    if (context.getType() !== 'http') return next.handle();

    const http = context.switchToHttp();
    const request = http.getRequest<ExpressRequest>();
    const response = http.getResponse<ExpressResponse>();

    const finish = this.metrics.startHttpRequest(request.method);

    // `close` fires for aborted requests where `finish` never will, and after
    // `finish` for the ordinary ones, so both are listened for and the first one
    // through wins. Without the flag the in-flight gauge would drift negative.
    let settled = false;
    const settle = () => {
      if (settled) return;
      settled = true;
      // Express attaches the matched route only once a handler is selected,
      // which has happened by now. It is the template (`/v1/movies/:id`), which
      // is what keeps the label's cardinality bounded by the route table.
      // `route` is untyped on Express' Request, so it is narrowed here rather
      // than read straight off an `any`.
      const route = (request.route as { path?: unknown } | undefined)?.path;
      finish(typeof route === 'string' ? route : undefined, response.statusCode);
    };

    response.once('finish', settle);
    response.once('close', settle);

    return next.handle();
  }
}
