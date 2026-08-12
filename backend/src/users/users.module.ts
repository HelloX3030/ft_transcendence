import { Module } from '@nestjs/common';
import { StorageModule } from 'src/storage/storage.module';
import { TmdbModule } from 'src/tmdb/tmdb.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [StorageModule, TmdbModule],
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
