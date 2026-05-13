import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { FriendsModule } from './friends/friends.module';
import { MoviesModule } from './movies/movies.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { WatchlistsModule } from './watchlists/watchlists.module';

@Module({
  imports: [PrismaModule, FriendsModule, MoviesModule, AuthModule, UsersModule, WatchlistsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
