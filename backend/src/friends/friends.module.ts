import { Module } from '@nestjs/common';
import { FriendsController } from './friends.controller';
import { FriendsService } from './friends.service';
import { NotifyModule } from 'src/notify/notify.module';

@Module({
  imports: [NotifyModule],
  controllers: [FriendsController],
  providers: [FriendsService],
})
export class FriendsModule {}
