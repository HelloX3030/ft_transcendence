import { Inject, Injectable, Logger } from '@nestjs/common';
import { REDIS_CLIENT, type RedisClient } from './redis.constants';

/**
 * Cache access that degrades gracefully: when Redis is unreachable, get()
 * reports a cache miss and set() is a no-op, so callers fall back to the
 * upstream source instead of failing the request.
 */
@Injectable()
export class RedisService {
  private readonly logger = new Logger(RedisService.name);

  constructor(@Inject(REDIS_CLIENT) private readonly redis: RedisClient) {}

  async get(key: string): Promise<string | null> {
    try {
      return await this.redis.get(key);
    } catch (err) {
      this.logger.warn(`Redis GET ${key} failed: ${(err as Error).message}`);
      return null;
    }
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    try {
      await this.redis.set(key, value, { EX: ttlSeconds });
    } catch (err) {
      this.logger.warn(`Redis SET ${key} failed: ${(err as Error).message}`);
    }
  }
}
