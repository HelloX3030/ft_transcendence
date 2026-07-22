import { Module } from '@nestjs/common';
import { UserUtils } from './user.utils';
import { FriendUtils } from './friend.utils';

@Module({
  providers: [UserUtils, FriendUtils],
  exports: [UserUtils, FriendUtils],
})
export class UtilsModule {}
