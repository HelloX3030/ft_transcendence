import { Module } from '@nestjs/common';
import { PopularController } from './popular.controller';
import { PopularService } from './popular.service';

@Module({
  controllers: [PopularController],
  providers: [PopularService],
})
export class PopularModule {}
