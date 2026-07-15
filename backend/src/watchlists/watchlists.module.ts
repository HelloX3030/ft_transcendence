import { Module } from '@nestjs/common';
import { WatchlistsService } from './watchlists.service';
import { WatchlistsController } from './watchlists.controller';
import { NotifyModule } from 'src/notify/notify.module';
import { UtilsModule } from 'src/utils/utils.module';

@Module({
  imports: [NotifyModule, UtilsModule],
  providers: [WatchlistsService],
  controllers: [WatchlistsController],
})
export class WatchlistsModule {}
