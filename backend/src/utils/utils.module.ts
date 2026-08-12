import { Module } from '@nestjs/common';
import { UserUtils } from './user.utils';
import { FriendUtils } from './friend.utils';
import { MovieUtils } from './movie.utils';

@Module({
  providers: [UserUtils, FriendUtils, MovieUtils],
  exports: [UserUtils, FriendUtils, MovieUtils],
})
export class UtilsModule {}
