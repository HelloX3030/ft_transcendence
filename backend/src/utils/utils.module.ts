import { Module } from '@nestjs/common';
import { UserUtils } from './user.utils';

@Module({
  providers: [UserUtils],
  exports: [UserUtils],
})
export class UtilsModule {}
