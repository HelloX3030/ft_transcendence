import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { PrismaService } from 'src/prisma/prisma.service';
import { UpdateUserDto } from './dto';

export const ME_SELECT = {
  id: true,
  username: true,
  email: true,
  image: true,
  language: true,
  role: true,
} as const;

export const PUBLIC_SELECT = {
  id: true,
  username: true,
  image: true,
} as const;

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

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
        throw new ForbiddenException('Username already taken');
      }
      throw error;
    }
  }

  async deleteMe(userId: number) {
    try {
      await this.prisma.users.delete({ where: { id: userId } });
    } catch (error) {
      if (!(error instanceof PrismaClientKnownRequestError && error.code === 'P2025')) {
        throw error;
      }
    }
    return { message: 'Account deleted' };
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
