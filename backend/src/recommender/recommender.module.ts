import { Module } from '@nestjs/common';
import { RecommenderClient } from './recommender.client';

@Module({
  providers: [RecommenderClient],
  exports: [RecommenderClient],
})
export class RecommenderModule {}
