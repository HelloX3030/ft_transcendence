import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { watchlistCreateDto, watchlistUpdateDto } from './dto';
import { watchlist_role, watchlists } from '@prisma/client';
import { watchlistMovieDto } from './dto/movie.dto';
import { successResponse } from 'src/utils';
import { watchlistRoleDto, watchlistUserDto } from './dto/user.dto';

// Number of movie posters stitched into a watchlist's mosaic cover.
export const WATCHLIST_COVER_LIMIT = 4;

// Pulls just enough movie posters to build the mosaic cover. Ordered by movieId
// (watchlist_movies has no timestamp) so the cover is stable between requests.
const COVER_INCLUDE = {
  watchlistMovies: {
    take: WATCHLIST_COVER_LIMIT,
    orderBy: { movieId: 'asc' },
    select: { movie: { select: { posterPath: true } } },
  },
} as const;
import { WatchlistResponse } from '@trailertinder/shared';

export const WATCHLIST_SELECT = {
  role: true,
  watchlist: { include: COVER_INCLUDE },
} as const;

@Injectable()
export class WatchlistsService {
  constructor(private prisma: PrismaService) {}

  // -------------------------
  // WATCHLIST
  // -------------------------

  async findAll(userId: number) {
    const watchlistUsers = await this.prisma.watchlist_users.findMany({
      where: {
        userId,
      },
      select: WATCHLIST_SELECT,
    });

    const watchlists = await Promise.all(
      watchlistUsers.map(({ role, watchlist }) =>
        this.toWatchlistDto(role, watchlist, this.extractPosterPaths(watchlist.watchlistMovies)),
      ),
    );
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
    const watchlist = await this.toWatchlistDto(
      userWatchlist.role,
      userWatchlist.watchlist,
      this.extractPosterPaths(userWatchlist.watchlist.watchlistMovies),
    );
    return successResponse(watchlist);
  }

  async create(dto: watchlistCreateDto, currentUserId: number) {
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
    // A freshly created watchlist has no movies yet, so the mosaic is empty.
    return successResponse(await this.toWatchlistDto(userWatchlist.role, watchlist, []));
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
      include: COVER_INCLUDE,
    });
    if (watchlist === null) throw new InternalServerErrorException();
    return successResponse(
      await this.toWatchlistDto(
        watchlistUser.role,
        watchlist,
        this.extractPosterPaths(watchlist.watchlistMovies),
      ),
    );
  }

  async remove(id: number, currentUserId: number) {
    await this.checkUserAccess(id, currentUserId);
    await this.prisma.watchlists.delete({
      where: {
        id,
      },
    });
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
      const meta = await this.getMovieMeta(dto.tmdbId);
      movie = await this.prisma.movies.create({
        data: {
          tmdbId: dto.tmdbId,
          name: meta.name,
          posterPath: meta.posterPath,
        },
      });
    }

    const watchlistMovie = await this.prisma.watchlist_movies.create({
      data: {
        watchlistId: id,
        movieId: movie.id,
      },
    });
    if (watchlistMovie === null) throw new InternalServerErrorException();
    return successResponse(null);
  }

  async removeMovie(id: number, movieId: number, currentUserId: number) {
    await this.checkUserAccess(id, currentUserId);
    await this.prisma.watchlist_movies.delete({
      where: {
        watchlistId_movieId: {
          watchlistId: id,
          movieId: movieId,
        },
      },
    });
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
    return successResponse(users);
  }

  async addUser(id: number, dto: watchlistUserDto, currentUserId: number) {
    await this.checkUserAccess(id, currentUserId);

    const watchlistUser = await this.prisma.watchlist_users.create({
      data: {
        watchlistId: id,
        userId: dto.userId,
        role: dto.role,
      },
    });
    if (watchlistUser === null) throw new InternalServerErrorException();
    return successResponse(null);
  }

  async updateUserRole(id: number, userId: number, dto: watchlistRoleDto, currentUserId: number) {
    if (userId === currentUserId) {
      throw new ForbiddenException('You cannot change your role');
    }
    await this.checkUserAccess(id, currentUserId);

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
    return successResponse(null);
  }

  async removeUser(id: number, userId: number, currentUserId: number) {
    if (userId == currentUserId) {
      const watchlistUsers = await this.prisma.watchlist_users.findMany({
        where: {
          watchlistId: id,
          role: 'editor',
        },
      });
      if (watchlistUsers.length === 1 && watchlistUsers[0].userId == userId) {
        throw new ConflictException(
          'The last editor cannot be removed. Delete the watchlist instead.',
        );
      }
    } else {
      await this.checkUserAccess(id, currentUserId);
    }

    await this.prisma.watchlist_users.delete({
      where: {
        watchlistId_userId: {
          watchlistId: id,
          userId: userId,
        },
      },
    });

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

  async toWatchlistDto(
    role: watchlist_role,
    watchlistDb: watchlists,
    posterPaths: string[],
  ): Promise<WatchlistResponse> {
    const editors: number[] = (
      await this.prisma.watchlist_users.findMany({
        where: {
          watchlistId: watchlistDb.id,
          role: 'editor',
        },
        select: {
          userId: true,
        },
      })
    ).map((editor) => editor.userId);
    const watchlist: WatchlistResponse = {
      id: watchlistDb.id,
      name: watchlistDb.name,
      image: watchlistDb.image,
      posterPaths,
      role: role,
      editorIds: editors,
      createdAt: watchlistDb.createdAt,
    };
    return watchlist;
  }

  extractPosterPaths(watchlistMovies: { movie: { posterPath: string | null } }[]): string[] {
    return watchlistMovies
      .map(({ movie }) => movie.posterPath)
      .filter((path): path is string => path !== null);
  }

  async getMovieMeta(tmdbId: number): Promise<{ name: string; posterPath: string | null }> {
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

      const posterPath =
        'poster_path' in json && typeof json.poster_path === 'string' ? json.poster_path : null;

      return { name: json.original_title, posterPath };
    } catch (error) {
      console.error(error);
      throw new InternalServerErrorException();
    }
  }
}
