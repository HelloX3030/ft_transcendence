import { ServiceUnavailableException } from '@nestjs/common';
import { TmdbBudget } from './tmdb.budget';

describe('TmdbBudget', () => {
  it('lets a burst up to the capacity through without waiting', async () => {
    // capacity 2 per 1s: one token every 500ms, 2 available immediately.
    const budget = new TmdbBudget(2, 1000, 100);

    const started = Date.now();
    await budget.acquire();
    await budget.acquire();

    expect(Date.now() - started).toBeLessThan(50);
  });

  it('paces requests past the burst instead of rejecting them', async () => {
    // capacity 2 per 100ms (a token every 50ms) with a generous max wait.
    const budget = new TmdbBudget(2, 100, 1000);
    await budget.acquire();
    await budget.acquire();

    const started = Date.now();
    await budget.acquire();

    expect(Date.now() - started).toBeGreaterThanOrEqual(40);
  });

  it('rejects with 503 when the wait would exceed the max', async () => {
    const budget = new TmdbBudget(2, 1000, 100);
    await budget.acquire();
    await budget.acquire();

    // The third would have to wait 500ms for a token — past the 100ms limit.
    await expect(budget.acquire()).rejects.toThrow(ServiceUnavailableException);
  });

  it('refuses concurrent callers beyond the burst rather than queueing them all', async () => {
    const budget = new TmdbBudget(2, 1000, 100);

    const results = await Promise.allSettled([
      budget.acquire(),
      budget.acquire(),
      budget.acquire(),
      budget.acquire(),
    ]);

    expect(results.map((result) => result.status)).toEqual([
      'fulfilled',
      'fulfilled',
      'rejected',
      'rejected',
    ]);
  });

  it('recovers once the window has passed', async () => {
    const budget = new TmdbBudget(2, 100, 0);
    await budget.acquire();
    await budget.acquire();
    await expect(budget.acquire()).rejects.toThrow(ServiceUnavailableException);

    await new Promise((resolve) => setTimeout(resolve, 120));

    await expect(budget.acquire()).resolves.toBeUndefined();
  });
});
