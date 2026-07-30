import { Module } from '@nestjs/common';
import { FriendsController } from './friends.controller';
import { FriendsService } from './friends.service';
import { NotifyModule } from 'src/notify/notify.module';
import { NotificationsModule } from 'src/notifications/notifications.module';
import { UtilsModule } from 'src/utils/utils.module';

@Module({
  imports: [NotifyModule, NotificationsModule, UtilsModule],
  controllers: [FriendsController],
  providers: [FriendsService],
})
export class FriendsModule {}
