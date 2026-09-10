import { Inject, Injectable, Logger } from '@nestjs/common';
import { REDIS_CLIENT, type RedisClient } from './redis.constants';
import { MetricsService } from 'src/metrics/metrics.service';

/**
 * Cache access that degrades gracefully: when Redis is unreachable, get()
 * reports a cache miss and set() is a no-op, so callers fall back to the
 * upstream source instead of failing the request.
 */
@Injectable()
export class RedisService {
  private readonly logger = new Logger(RedisService.name);

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: RedisClient,
    private readonly metrics: MetricsService,
  ) {}

  async get(key: string): Promise<string | null> {
    try {
      const value = await this.redis.get(key);
      // Every cached read in the app funnels through here, so the hit ratio is
      // measured once rather than at each call site. A Redis outage shows up as
      // `error` rather than being counted as a miss: both fall back to the
      // upstream, but only one of them is a problem.
      this.metrics.recordCacheRead(key, value === null ? 'miss' : 'hit');
      return value;
    } catch (err) {
      this.metrics.recordCacheRead(key, 'error');
      this.logger.warn(`Redis GET ${key} failed: ${(err as Error).message}`);
      return null;
    }
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    try {
      await this.redis.set(key, value, { EX: ttlSeconds });
      this.metrics.recordCacheWrite(key, 'ok');
    } catch (err) {
      this.metrics.recordCacheWrite(key, 'error');
      this.logger.warn(`Redis SET ${key} failed: ${(err as Error).message}`);
    }
  }
}
