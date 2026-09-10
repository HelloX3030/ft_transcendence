import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { PrismaService } from 'src/prisma/prisma.service';
import { MetricsService } from './metrics.service';

/** How often the database is asked for the totals below. */
const REFRESH_MS = 30_000;

/**
 * Keeps the `app_*` gauges current.
 *
 * On a timer rather than computed inside the scrape handler: these are `COUNT(*)`
 * queries, and a scrape is an unauthenticated-shaped, externally-triggered event
 * that Prometheus will retry. Tying database work to it means a misconfigured
 * scrape interval, or a second Prometheus, multiplies load onto Postgres. A
 * timer decouples the two — the gauge is at most REFRESH_MS stale, which is
 * irrelevant for totals that move a few times an hour.
 */
@Injectable()
export class BusinessMetricsCollector {
  private readonly logger = new Logger(BusinessMetricsCollector.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly metrics: MetricsService,
  ) {}

  @Interval(REFRESH_MS)
  async refresh(): Promise<void> {
    try {
      const [users, ratings, movies, watchlists, messages, activeSessions, friendships] =
        await Promise.all([
          this.prisma.users.count(),
          this.prisma.ratings.count(),
          this.prisma.movies.count(),
          this.prisma.watchlists.count(),
          this.prisma.messages.count(),
          this.prisma.sessions.count({ where: { expiresAt: { gt: new Date() } } }),
          this.prisma.friends.groupBy({ by: ['status'], _count: { _all: true } }),
        ]);

      this.metrics.setBusinessTotals({
        users,
        ratings,
        movies,
        watchlists,
        messages,
        activeSessions,
      });

      for (const row of friendships) {
        this.metrics.setFriendshipTotal(row.status, row._count._all);
      }
    } catch (error) {
      // A database hiccup must not take the process down over a gauge. The
      // previous values stay published and the next tick picks them back up.
      this.logger.warn(`Business metrics refresh failed: ${(error as Error).message}`);
    }
  }
}
