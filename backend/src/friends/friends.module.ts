import { Module } from '@nestjs/common';
import { FriendsController } from './friends.controller';
import { FriendsService } from './friends.service';
import { NotifyModule } from 'src/notify/notify.module';
import { UtilsModule } from 'src/utils/utils.module';

@Module({
  imports: [NotifyModule, UtilsModule],
  controllers: [FriendsController],
  providers: [FriendsService],
})
export class FriendsModule {}
