import { Module } from '@nestjs/common';
import { UserUtils } from './user';

@Module({
  providers: [UserUtils],
  exports: [UserUtils],
})
export class UtilsModule {}
