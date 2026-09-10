import { Controller, Get, Res, UseGuards, VERSION_NEUTRAL } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Response as ExpressResponse } from 'express';
import { Public } from 'src/auth/guard';
import { SKIP_ALL_THROTTLES } from 'src/throttle.config';
import { MetricsTokenGuard } from './metrics-token.guard';
import { MetricsService } from './metrics.service';

/**
 * Prometheus' scrape target. Reached only as `http://backend:3000/metrics` from
 * inside the Docker network: the Caddyfile answers 404 for `/api/metrics`, so
 * there is no route to it through the published origin.
 *
 * VERSION_NEUTRAL because the app is URI-versioned with a default of 1, and a
 * scrape path that moves to /v2/metrics with the API would silently break the
 * target. `@Public()` steps past the global JwtAccessGuard — a scraper has no
 * session to present — and MetricsTokenGuard takes its place.
 */
@Public()
// A scrape that is answered with 429 is not a slow scrape, it is a hole in every
// graph, and the alert rules read those graphs.
@SkipThrottle(SKIP_ALL_THROTTLES)
@UseGuards(MetricsTokenGuard)
@ApiExcludeController()
@Controller({ path: 'metrics', version: VERSION_NEUTRAL })
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Get()
  async scrape(@Res() res: ExpressResponse): Promise<void> {
    res.set('Content-Type', this.metrics.contentType);
    res.send(await this.metrics.render());
  }
}
