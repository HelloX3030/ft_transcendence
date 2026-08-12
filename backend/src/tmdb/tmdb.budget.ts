import { ServiceUnavailableException } from '@nestjs/common';

/**
 * Paces outbound TMDB requests so this backend stays inside the rate limit no
 * matter what the cache is doing — a cold cache, a Redis outage (every request
 * becomes a miss) or a burst of traffic can't turn into upstream 429s, which
 * TMDB applies per IP and so would degrade the app for every user at once.
 * The capacity and window are configured in tmdb.client.ts.
 *
 * Implemented as GCRA (a leaky bucket expressed as a single timestamp): `tat` is
 * the moment the bucket would run dry. Callers arriving before
 * `tat - burstTolerance` pass straight through, so a burst up to `capacity` is
 * still instant; later callers wait their turn; and anything that would have to
 * wait longer than `maxWaitMs` is rejected rather than queued, because piling up
 * requests the user has already given up on helps nobody.
 *
 * Per-process, like the service's single-flight — it bounds one instance's
 * upstream traffic, not a whole cluster's.
 */
export class TmdbBudget {
  private readonly emissionIntervalMs: number;
  private readonly burstToleranceMs: number;

  // Theoretical arrival time of the next request: 0 means the bucket is idle.
  private tat = 0;

  constructor(
    capacity: number,
    windowMs: number,
    private readonly maxWaitMs: number,
  ) {
    this.emissionIntervalMs = windowMs / capacity;
    this.burstToleranceMs = (capacity - 1) * this.emissionIntervalMs;
  }

  /**
   * Resolves when the caller may issue its request, after waiting for capacity
   * if needed. Throws ServiceUnavailableException when the wait would exceed
   * maxWaitMs.
   */
  async acquire(): Promise<void> {
    const now = Date.now();
    const arrival = Math.max(this.tat, now);
    const waitMs = arrival - this.burstToleranceMs - now;

    if (waitMs > this.maxWaitMs) {
      throw new ServiceUnavailableException('TMDB request budget exhausted, please retry shortly');
    }

    // Claim the slot before waiting, so concurrent callers queue behind this one
    // instead of all racing for the same token.
    this.tat = arrival + this.emissionIntervalMs;
    if (waitMs > 0) await new Promise((resolve) => setTimeout(resolve, waitMs));
  }
}
