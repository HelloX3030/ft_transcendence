import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { extname } from 'path';
import { PrismaService } from 'src/prisma/prisma.service';
import { StorageService } from 'src/storage/storage.service';
import { OnboardingDto, SearchUsersDto, UpdateUserDto } from './dto';

export const ME_SELECT = {
  id: true,
  username: true,
  email: true,
  image: true,
  language: true,
  role: true,
  onboardingCompleted: true,
  genreIds: true,
  actorIds: true,
  directorIds: true,
} as const;

// TODO: replace with real preference extraction derived from the movies the user
// picked during onboarding (feeding the recommendation algorithm). For now we stamp
// deterministic mock values so the frontend can be built against a realistic /me
// response. The genre ids are real TMDB ids so they resolve to names in the UI.
const MOCK_ONBOARDING_GENRE_IDS = [28, 12, 878, 18, 53];
const MOCK_ONBOARDING_ACTOR_IDS = [500, 287, 1245, 6193];
const MOCK_ONBOARDING_DIRECTOR_IDS = [525, 138, 1032];

export const PUBLIC_SELECT = {
  id: true,
  username: true,
  image: true,
} as const;

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
  ) {}

  async getMe(userId: number) {
    return this.prisma.users.findUnique({
      where: { id: userId },
      select: ME_SELECT,
    });
  }

  async completeOnboarding(userId: number, dto: OnboardingDto) {
    // dto.movieIds is accepted and validated now; deriving real preferences from it
    // is a TODO. For now we mark onboarding done and stamp mock preferences.
    this.logger.debug(
      `Onboarding user ${userId} with ${dto.movieIds.length} movies — applying mock preferences`,
    );
    return this.prisma.users.update({
      where: { id: userId },
      data: {
        onboardingCompleted: true,
        genreIds: MOCK_ONBOARDING_GENRE_IDS,
        actorIds: MOCK_ONBOARDING_ACTOR_IDS,
        directorIds: MOCK_ONBOARDING_DIRECTOR_IDS,
      },
      select: ME_SELECT,
    });
  }

  async updateMe(userId: number, dto: UpdateUserDto) {
    try {
      return await this.prisma.users.update({
        where: { id: userId },
        data: dto,
        select: ME_SELECT,
      });
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError && error.code === 'P2002') {
        const target = (error.meta?.target as string[]) ?? [];
        if (target.includes('email')) throw new ForbiddenException('Email already taken');
        throw new ForbiddenException('Username already taken');
      }
      throw error;
    }
  }

  async uploadAvatar(userId: number, file: Express.Multer.File) {
    const current = await this.prisma.users.findUnique({
      where: { id: userId },
      select: { image: true },
    });
    const oldKey = this.storage.extractKey(current?.image);

    const key = `${userId}-${Date.now()}${extname(file.originalname)}`;
    const imageUrl = await this.storage.upload(key, file.buffer, file.mimetype);
    const updated = await this.prisma.users.update({
      where: { id: userId },
      data: { image: imageUrl },
      select: ME_SELECT,
    });

    if (oldKey) await this.storage.delete(oldKey);
    return updated;
  }

  async deleteMe(userId: number) {
    const current = await this.prisma.users.findUnique({
      where: { id: userId },
      select: { image: true },
    });
    const oldKey = this.storage.extractKey(current?.image);

    await this.prisma.users.delete({ where: { id: userId } });

    if (oldKey) await this.storage.delete(oldKey);
    return { message: 'Account deleted' };
  }

  async searchUsers(requesterId: number, dto: SearchUsersDto) {
    const { query, page, limit } = dto;
    const where: Prisma.usersWhereInput = {
      username: { contains: query, mode: Prisma.QueryMode.insensitive },
      id: { not: requesterId },
    };

    const [total, results] = await Promise.all([
      this.prisma.users.count({ where }),
      this.prisma.users.findMany({
        where,
        select: PUBLIC_SELECT,
        orderBy: { username: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return { page, limit, total, results };
  }

  async getUser(userId: number) {
    const user = await this.prisma.users.findUnique({
      where: { id: userId },
      select: PUBLIC_SELECT,
    });
    if (user === null) throw new NotFoundException('User not found');
    return user;
  }
}
