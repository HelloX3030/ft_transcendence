import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { watchlistCreateDto, watchlistDto, watchlistUpdateDto } from './dto';
import { watchlist_role, watchlists } from '@prisma/client';
import { movieDto } from './dto/movie.dto';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { successResponse } from 'src/helper';

export const WATCHLIST_SELECT = {
  role: true,
  watchlist: true,
} as const;

@Injectable()
export class WatchlistsService {
  constructor(private prisma: PrismaService) {}

  async findAll(userId: number) {
    const watchlists = (
      await this.prisma.watchlist_users.findMany({
        where: {
          userId,
        },
        select: WATCHLIST_SELECT,
      })
    ).map(({ role, watchlist }) => this.toWatchlistDto(role, watchlist));
    if (watchlists === null) throw new InternalServerErrorException();
    return successResponse(watchlists);
  }

  async findOne(id: number, userId: number) {
    const userWatchlist = await this.prisma.watchlist_users.findUnique({
      where: {
        watchlistId_userId: { watchlistId: id, userId: userId },
      },
      select: WATCHLIST_SELECT,
    });
    if (userWatchlist === null) throw new BadRequestException();
    const watchlist = this.toWatchlistDto(userWatchlist.role, userWatchlist.watchlist);
    return successResponse(watchlist);
  }

  async create(dto: watchlistCreateDto, userId: number) {
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
    return successResponse(this.toWatchlistDto(userWatchlist.role, watchlist));
  }

  async update(id: number, dto: watchlistUpdateDto, userId: number) {
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
    return successResponse(this.toWatchlistDto(watchlistUser.role, watchlist));
  }

  async remove(id: number, userId: number) {
    const watchlistUser = await this.checkUserAccess(id, userId);
    if (watchlistUser.role === 'viewer') {
      throw new ForbiddenException('You have read-only access');
    }
    await this.prisma.watchlists.delete({
      where: {
        id,
      },
    });
    return successResponse(null);
  }

  async getMovies(id: number, userId: number) {
    await this.checkUserAccess(id, userId);
    const movies = await this.prisma.watchlist_movies.findMany({
      where: {
        watchlistId: id,
      },
      select: {
        movie: true,
      },
    });
    if (movies === null) throw new InternalServerErrorException();
    return successResponse(movies.map(({ movie }) => movie));
  }

  async addMovie(id: number, dto: movieDto, userId: number) {
    const watchlistUser = await this.checkUserAccess(id, userId);
    if (watchlistUser.role === 'viewer') {
      throw new ForbiddenException('You have read-only access');
    }
    let movie = await this.prisma.movies.findUnique({
      where: {
        tmdbId: dto.tmdbId,
      },
    });
    if (movie === null) {
      const movieTitel = await this.getMovieTitel(dto.tmdbId);
      movie = await this.prisma.movies.create({
        data: {
          tmdbId: dto.tmdbId,
          name: movieTitel,
        },
      });
      if (movie === null) throw new InternalServerErrorException();
    }

    try {
      const watchlistMovie = await this.prisma.watchlist_movies.create({
        data: {
          watchlistId: id,
          movieId: movie.id,
        },
      });
      if (watchlistMovie === null) throw new InternalServerErrorException();
      return successResponse(null);
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ForbiddenException('Movie already added');
        }
      }
      console.error(error);
      throw new InternalServerErrorException();
    }
  }

  async removeMovie(id: number, movieId: number, userId: number) {
    const watchlistUser = await this.checkUserAccess(id, userId);
    if (watchlistUser.role === 'viewer') {
      throw new ForbiddenException('You have read-only access');
    }
    try {
      await this.prisma.watchlist_movies.delete({
        where: {
          watchlistId_movieId: {
            watchlistId: id,
            movieId: movieId,
          },
        },
      });
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new NotFoundException('Movie not found.');
        }
      }
      console.error(error);
      throw new InternalServerErrorException();
    }
    return successResponse(null);
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

  async getMovieTitel(tmdbId: number) {
    const url = 'https://api.themoviedb.org/3/movie/' + tmdbId;
    const options = {
      method: 'GET',
      headers: {
        accept: 'application/json',
        Authorization: 'Bearer ' + process.env.TMDB_API_KEY,
      },
    };

    try {
      const res = await fetch(url, options);
      if (!res.ok) throw new Error(`TMDB API error: ${res.status}`);
      const json = await res.json();

      if (typeof json !== 'object' || json === null || typeof json.original_title !== 'string') {
        throw new Error('Invalid TMDB API response');
      }

      return json.original_title;
    } catch (error) {
      console.error(error);
      throw new InternalServerErrorException();
    }
  }
}
