import { ServiceUnavailableException } from '@nestjs/common';

/**
 * Paces outbound TMDB requests so a cold cache, a Redis outage or a burst of
 * traffic cannot turn into upstream 429s, which TMDB applies per IP. The capacity
 * and window are configured in tmdb.client.ts.
 *
 * GCRA, a leaky bucket expressed as one timestamp: `tat` is the moment the bucket
 * would run dry. Callers arriving before `tat - burstTolerance` pass straight
 * through, later ones wait their turn, and anything that would wait longer than
 * `maxWaitMs` is rejected rather than queued. Per-process, like the service's
 * single-flight.
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
