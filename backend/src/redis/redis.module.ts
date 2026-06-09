import { Global, Module } from '@nestjs/common';
import { createClient } from 'redis';
import { REDIS_CLIENT, type RedisClient } from './redis.constants';

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: async (): Promise<RedisClient> => {
        const client = createClient({ url: process.env.REDIS_URL });
        await client.connect();
        return client;
      },
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
