export const REDIS_CLIENT = 'REDIS_CLIENT';

export interface RedisClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, options?: { EX?: number }): Promise<unknown>;
}
