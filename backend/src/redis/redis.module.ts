import { Global, Inject, Logger, Module, OnModuleDestroy } from '@nestjs/common';
import { createClient } from 'redis';
import { REDIS_CLIENT, type RedisClient } from './redis.constants';
import { RedisService } from './redis.service';

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: (): RedisClient => {
        const logger = new Logger(RedisModule.name);
        // disableOfflineQueue: commands fail fast while Redis is unreachable
        // instead of queueing forever — RedisService turns that into a cache miss.
        const client = createClient({ url: process.env.REDIS_URL, disableOfflineQueue: true });
        client.on('error', (err: Error) => logger.warn(`Redis error: ${err.message}`));
        // Connect in the background so the app boots (and serves uncached
        // requests) even when Redis is down; the client retries on its own.
        client.connect().catch((err: Error) => {
          logger.warn(`Redis connect failed: ${err.message}`);
        });
        return client;
      },
    },
    RedisService,
  ],
  exports: [RedisService],
})
export class RedisModule implements OnModuleDestroy {
  private readonly logger = new Logger(RedisModule.name);

  constructor(@Inject(REDIS_CLIENT) private readonly redis: RedisClient) {}

  // Close the connection on shutdown so the socket doesn't keep the process
  // alive — otherwise Jest reports a worker that fails to exit gracefully.
  async onModuleDestroy() {
    try {
      await this.redis.quit();
    } catch (err) {
      this.logger.warn(`Redis quit failed: ${(err as Error).message}`);
    }
  }
}
