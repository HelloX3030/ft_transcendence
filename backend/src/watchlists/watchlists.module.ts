import { Module } from '@nestjs/common';
import { WatchlistsService } from './watchlists.service';
import { WatchlistsController } from './watchlists.controller';
import { NotificationsModule } from 'src/notifications/notifications.module';
import { UtilsModule } from 'src/utils/utils.module';

@Module({
  imports: [NotificationsModule, UtilsModule],
  providers: [WatchlistsService],
  controllers: [WatchlistsController],
})
export class WatchlistsModule {}
