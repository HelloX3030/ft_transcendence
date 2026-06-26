import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { extname } from 'path';
import { PrismaService } from 'src/prisma/prisma.service';
import { StorageService } from 'src/storage/storage.service';
import { SearchUsersDto, UpdateUserDto } from './dto';

export const ME_SELECT = {
  id: true,
  username: true,
  email: true,
  image: true,
  language: true,
  role: true,
  genreIds: true,
  actorIds: true,
  directorIds: true,
} as const;

export const PUBLIC_SELECT = {
  id: true,
  username: true,
  image: true,
} as const;

@Injectable()
export class UsersService {
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
