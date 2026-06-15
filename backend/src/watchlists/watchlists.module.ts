import { Module } from '@nestjs/common';
import { WatchlistsService } from './watchlists.service';
import { WatchlistsController } from './watchlists.controller';

@Module({
  providers: [WatchlistsService],
  controllers: [WatchlistsController],
})
export class WatchlistsModule {}
