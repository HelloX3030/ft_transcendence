import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { watchlistCreateDto, watchlistDto, watchlistsDto, watchlistUpdateDto } from './dto';
import { watchlist_role, watchlists } from '@prisma/client';

export const WATCHLIST_SELECT = {
  role: true,
  watchlist: true,
} as const;

@Injectable()
export class WatchlistsService {
  constructor(private prisma: PrismaService) {}

  async findAll(userId: number): Promise<watchlistsDto> {
    const watchlists = (
      await this.prisma.watchlist_users.findMany({
        where: {
          userId,
        },
        select: WATCHLIST_SELECT,
      })
    ).map(({ role, watchlist }) => this.toWatchlistDto(role, watchlist));
    if (watchlists === null) throw new InternalServerErrorException();
    return { watchlists: watchlists };
  }

  async findOne(id: number, userId: number): Promise<{ watchlist: watchlistDto }> {
    const userWatchlist = await this.prisma.watchlist_users.findUnique({
      where: {
        watchlistId_userId: { watchlistId: id, userId: userId },
      },
      select: WATCHLIST_SELECT,
    });
    if (userWatchlist === null) throw new BadRequestException();
    const watchlist = this.toWatchlistDto(userWatchlist.role, userWatchlist.watchlist);
    return { watchlist: watchlist };
  }

  async create(dto: watchlistCreateDto, userId: number): Promise<{ watchlist: watchlistDto }> {
    const watchlist = await this.prisma.watchlists.create({
      data: {
        name: dto.name,
        image: dto.image,
      },
    });
    if (watchlist === null) throw new InternalServerErrorException();
    const userWatchlist = await this.prisma.watchlist_users.create({
      data: {
        userId: userId,
        watchlistId: watchlist.id,
        role: 'owner',
      },
    });
    if (userWatchlist === null) throw new InternalServerErrorException();
    return { watchlist: this.toWatchlistDto(userWatchlist.role, watchlist) };
  }

  async update(
    id: number,
    dto: watchlistUpdateDto,
    userId: number,
  ): Promise<{ watchlist: watchlistDto }> {
    const watchlistUser = await this.checkUserAccess(id, userId);
    if (watchlistUser.role === 'viewer') {
      throw new ForbiddenException('You have read-only access');
    }
    const watchlist = await this.prisma.watchlists.update({
      where: {
        id,
      },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.image !== undefined && { image: dto.image }),
      },
    });
    return {
      watchlist: this.toWatchlistDto(watchlistUser.role, watchlist),
    };
  }

  async remove(id: number, userId: number): Promise<{ message: string }> {
    const watchlistUser = await this.checkUserAccess(id, userId);
    if (watchlistUser.role === 'viewer') {
      throw new ForbiddenException('You have read-only access');
    }
    await this.prisma.watchlists.delete({
      where: {
        id,
      },
    });
    return {
      message: 'Deleted successfully',
    };
  }

  async checkUserAccess(watchlistId: number, userId: number) {
    const watchlistUser = await this.prisma.watchlist_users.findUnique({
      where: {
        watchlistId_userId: {
          userId,
          watchlistId: watchlistId,
        },
      },
    });
    if (!watchlistUser) {
      throw new ForbiddenException('Invalid watchlist');
    }
    return watchlistUser;
  }

  toWatchlistDto(role: watchlist_role, watchlistDb: watchlists): watchlistDto {
    const watchlist: watchlistDto = {
      id: watchlistDb.id,
      name: watchlistDb.name,
      image: watchlistDb.image,
      role: role,
      createdAt: watchlistDb.createdAt,
    };
    return watchlist;
  }
}
