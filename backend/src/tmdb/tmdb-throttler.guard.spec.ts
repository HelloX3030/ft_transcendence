import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import type { Request } from 'express';
import { TmdbThrottlerGuard } from './tmdb-throttler.guard';

describe('TmdbThrottlerGuard', () => {
  let guard: TmdbThrottlerGuard;

  // The tracker is protected; calling it directly is the only way to assert the
  // bucket key without standing up a full HTTP pipeline.
  const trackerFor = (req: Partial<Request>): Promise<string> =>
    (guard as unknown as { getTracker: (req: Partial<Request>) => Promise<string> }).getTracker(
      req,
    );

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([{ name: 'burst', ttl: 10_000, limit: 30 }])],
      providers: [TmdbThrottlerGuard],
    }).compile();
    guard = module.get<TmdbThrottlerGuard>(TmdbThrottlerGuard);
  });

  it('buckets by user id so shared IPs are not throttled together', async () => {
    const tracker = await trackerFor({ user: { sub: 7, email: 'a@b.c' }, ip: '10.0.0.1' });

    expect(tracker).toBe('user:7');
  });

  it('gives two users on the same IP separate buckets', async () => {
    const first = await trackerFor({ user: { sub: 1, email: 'a@b.c' }, ip: '10.0.0.1' });
    const second = await trackerFor({ user: { sub: 2, email: 'd@e.f' }, ip: '10.0.0.1' });

    expect(first).not.toBe(second);
  });

  it('falls back to the IP when there is no authenticated user', async () => {
    const tracker = await trackerFor({ ip: '10.0.0.1' });

    expect(tracker).toBe('ip:10.0.0.1');
  });
});
