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
import { watchlistMovieDto } from './dto/movie.dto';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { successResponse } from 'src/helper';
import { watchlistRoleDto, watchlistUserDto } from './dto/user.dto';

export const WATCHLIST_SELECT = {
  role: true,
  watchlist: true,
} as const;

@Injectable()
export class WatchlistsService {
  constructor(private prisma: PrismaService) {}

  // -------------------------
  // WATCHLIST
  // -------------------------

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

  async findOne(id: number, currentUserId: number) {
    const userWatchlist = await this.prisma.watchlist_users.findUnique({
      where: {
        watchlistId_userId: { watchlistId: id, userId: currentUserId },
      },
      select: WATCHLIST_SELECT,
    });
    if (userWatchlist === null) throw new NotFoundException('Watchlists not found.');
    const watchlist = this.toWatchlistDto(userWatchlist.role, userWatchlist.watchlist);
    return successResponse(watchlist);
  }

  async create(dto: watchlistCreateDto, currentUserId: number) {
    try {
      const watchlist = await this.prisma.watchlists.create({
        data: {
          name: dto.name,
          image: dto.image,
          watchlistUsers: {
            create: {
              userId: currentUserId,
              role: 'editor',
            },
          },
        },
        include: {
          watchlistUsers: true,
        },
      });
      const userWatchlist = watchlist.watchlistUsers[0];
      return successResponse(this.toWatchlistDto(userWatchlist.role, watchlist));
    } catch (error) {
      console.error(error);
      throw new InternalServerErrorException();
    }
  }

  async update(id: number, dto: watchlistUpdateDto, currentUserId: number) {
    if (dto.name === undefined && dto.image === undefined) {
      throw new BadRequestException('There is no data to update.');
    }
    const watchlistUser = await this.checkUserAccess(id, currentUserId);
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

  async remove(id: number, currentUserId: number) {
    await this.checkUserAccess(id, currentUserId);
    try {
      await this.prisma.watchlists.delete({
        where: {
          id,
        },
      });
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new NotFoundException('Watchlists not found.');
        }
      }
      console.error(error);
      throw new InternalServerErrorException();
    }
    return successResponse(null);
  }

  // -------------------------
  // MOVIES
  // -------------------------

  async getMovies(id: number, currentUserId: number) {
    await this.checkUserAccess(id, currentUserId, false);
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

  async addMovie(id: number, dto: watchlistMovieDto, currentUserId: number) {
    await this.checkUserAccess(id, currentUserId);
    let movie = await this.prisma.movies.findUnique({
      where: {
        tmdbId: dto.tmdbId,
      },
    });
    if (movie === null) {
      try {
        const movieTitel = await this.getMovieTitel(dto.tmdbId);
        movie = await this.prisma.movies.create({
          data: {
            tmdbId: dto.tmdbId,
            name: movieTitel,
          },
        });
      } catch (error) {
        console.log(error);
        throw new InternalServerErrorException();
      }
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
          throw new ForbiddenException('Movie already added.');
        }
      }
      console.error(error);
      throw new InternalServerErrorException();
    }
  }

  async removeMovie(id: number, movieId: number, currentUserId: number) {
    await this.checkUserAccess(id, currentUserId);
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

  // -------------------------
  // USERS
  // -------------------------

  async getUsers(id: number, currentUserId: number) {
    await this.checkUserAccess(id, currentUserId, false);
    const users = await this.prisma.watchlist_users.findMany({
      where: {
        watchlistId: id,
      },
      select: {
        userId: true,
        role: true,
      },
    });
    if (users === null) throw new InternalServerErrorException();
    return successResponse(users);
  }

  async addUser(id: number, dto: watchlistUserDto, currentUserId: number) {
    await this.checkUserAccess(id, currentUserId);

    try {
      const watchlistUser = await this.prisma.watchlist_users.create({
        data: {
          watchlistId: id,
          userId: dto.userId,
          role: dto.role,
        },
      });
      if (watchlistUser === null) throw new InternalServerErrorException();
      return successResponse(null);
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ForbiddenException('User already added');
        }
        if (error.code === 'P2003') {
          throw new NotFoundException('User not found.');
        }
      }
      console.error(error);
      throw new InternalServerErrorException();
    }
  }

  async updateUserRole(id: number, userId: number, dto: watchlistRoleDto, currentUserId: number) {
    if (userId === currentUserId) {
      throw new ForbiddenException('You cannot change your role');
    }
    await this.checkUserAccess(id, currentUserId);
    try {
      await this.prisma.watchlist_users.update({
        where: {
          watchlistId_userId: {
            watchlistId: id,
            userId: userId,
          },
        },
        data: {
          role: dto.role,
        },
      });
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new NotFoundException(
            'Cout could not find the user to update as a user of the given watchlist.',
          );
        }
      }
      console.error(error);
      throw new InternalServerErrorException();
    }
    return successResponse(null);
  }

  async removeUser(id: number, userId: number, currentUserId: number) {
    if (userId != currentUserId) {
      await this.checkUserAccess(id, currentUserId);
    }
    try {
      await this.prisma.watchlist_users.delete({
        where: {
          watchlistId_userId: {
            watchlistId: id,
            userId: userId,
          },
        },
      });

      const watchlistUsers = await this.prisma.watchlist_users.findMany({
        where: {
          watchlistId: id,
          role: 'editor',
        },
      });
      if (watchlistUsers.length === 0) {
        await this.prisma.watchlists.delete({
          where: {
            id,
          },
        });
      }
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new NotFoundException('Watchlist or user not found.');
        }
      }
      console.error(error);
      throw new InternalServerErrorException();
    }
    return successResponse(null);
  }

  async checkUserAccess(watchlistId: number, userId: number, isEditor: boolean = true) {
    const watchlistUser = await this.prisma.watchlist_users.findUnique({
      where: {
        watchlistId_userId: {
          userId,
          watchlistId: watchlistId,
        },
      },
    });
    if (!watchlistUser) {
      throw new NotFoundException('Watchlists not found.');
    }
    if (isEditor && watchlistUser.role === 'viewer') {
      throw new ForbiddenException('You have read-only access.');
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
      const json: unknown = (await res.json()) as unknown;

      if (
        typeof json !== 'object' ||
        json === null ||
        !('original_title' in json) ||
        typeof json.original_title !== 'string'
      ) {
        throw new Error('Invalid TMDB API response.');
      }

      return json.original_title;
    } catch (error) {
      console.error(error);
      throw new InternalServerErrorException();
    }
  }
}
