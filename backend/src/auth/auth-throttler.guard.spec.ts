import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import type { Request } from 'express';
import { AuthThrottlerGuard } from './auth-throttler.guard';
import { AUTH_ATTEMPTS_PER_WINDOW, AUTH_WINDOW_MS, THROTTLERS } from '../throttle.config';

describe('AuthThrottlerGuard', () => {
  let guard: AuthThrottlerGuard;

  // getTracker is protected; calling it directly is the only way to assert the
  // bucket key without standing up a full HTTP pipeline.
  const trackerFor = (req: Partial<Request>): Promise<string> =>
    (guard as unknown as { getTracker: (req: Partial<Request>) => Promise<string> }).getTracker(
      req,
    );

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot(THROTTLERS)],
      providers: [AuthThrottlerGuard],
    }).compile();
    guard = module.get<AuthThrottlerGuard>(AuthThrottlerGuard);
  });

  it('buckets by client IP', async () => {
    expect(await trackerFor({ ip: '10.0.0.1' })).toBe('ip:10.0.0.1');
  });

  it('gives two IPs separate buckets', async () => {
    const first = await trackerFor({ ip: '10.0.0.1' });
    const second = await trackerFor({ ip: '10.0.0.2' });

    expect(first).not.toBe(second);
  });

  it('ignores any user on the request, so the bucket cannot be widened', async () => {
    const anonymous = await trackerFor({ ip: '10.0.0.1' });
    const withUser = await trackerFor({ ip: '10.0.0.1', user: { sub: 7, email: 'a@b.c' } });

    expect(withUser).toBe(anonymous);
  });

  it('still buckets when express reports no IP', async () => {
    expect(await trackerFor({})).toBe('ip:unknown');
  });
});

describe('auth throttle window', () => {
  it('is tight enough to put a 6-digit TOTP out of reach', () => {
    const attemptsPerDay = AUTH_ATTEMPTS_PER_WINDOW * (86_400_000 / AUTH_WINDOW_MS);
    const daysToExhaustTotpSpace = 1_000_000 / attemptsPerDay;

    expect(daysToExhaustTotpSpace).toBeGreaterThan(30);
  });

  it('still leaves room for real users sharing one NAT address', () => {
    expect(AUTH_ATTEMPTS_PER_WINDOW).toBeGreaterThanOrEqual(20);
  });
});
