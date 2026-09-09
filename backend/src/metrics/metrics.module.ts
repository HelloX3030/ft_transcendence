import { Global, Module } from '@nestjs/common';
import { BusinessMetricsCollector } from './business-metrics.collector';
import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';

/**
 * Global, like PrismaModule and RedisModule: instrumentation cuts across auth,
 * TMDB, the recommender, mail, storage and the gateway, and threading an import
 * into every one of those modules is churn that says nothing.
 *
 * No ScheduleModule.forRoot() here even though the collector is an @Interval:
 * AuthModule already registers it, and the scheduler discovers timed methods
 * across the whole container rather than per importing module — NotifyGateway's
 * token sweep relies on the same thing.
 */
@Global()
@Module({
  controllers: [MetricsController],
  providers: [MetricsService, BusinessMetricsCollector],
  exports: [MetricsService],
})
export class MetricsModule {}
