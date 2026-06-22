import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { extname } from 'path';
import { PrismaService } from 'src/prisma/prisma.service';
import { StorageService } from 'src/storage/storage.service';
import { UpdateUserDto } from './dto';
import { generate, generateSecret, generateURI, verify } from 'otplib';
import * as crypto from 'crypto';
import { decrypt, encrypt, getMfaKey, successResponse } from 'src/utils';
import { use } from 'passport';
import { verifyTOTP } from 'src/utils/otp.utils';

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

  async getUser(userId: number) {
    const user = await this.prisma.users.findUnique({
      where: { id: userId },
      select: PUBLIC_SELECT,
    });
    if (user === null) throw new NotFoundException('User not found');
    return user;
  }

  async createTOTP(userId: number) {
    const user = await this.prisma.users.findUnique({
      where: {
        id: userId,
      },
      select: {
        totpActive: true,
      },
    });
    if (user === null) throw new BadRequestException('User not found.');
    if (user.totpActive)
      throw new BadRequestException('TOTP alrady set, remove it first to set a new TOTP.');

    const secret = generateSecret();
    console.log(secret);

    const appName = process.env.APP_NAME;
    if (appName === undefined) {
      console.error('The env "APP_NAME" is not set.');
      throw new InternalServerErrorException();
    }

    // Generate QR code URI for authenticator apps
    const uri = generateURI({
      issuer: appName,
      label: '',
      secret,
      digits: 6,
      period: 30,
    });
    console.log(uri);

    const key = getMfaKey();
    const iv = crypto.randomBytes(16);
    let encryptedSecret = iv.toString('hex') + ':';
    encryptedSecret += encrypt(secret, key, iv);

    await this.prisma.users.update({
      where: {
        id: userId,
      },
      data: {
        totpSecret: encryptedSecret,
      },
    });

    return uri;
  }

  async activateTOTP(userId: number, otp: string) {
    const user = await this.prisma.users.findUnique({
      where: {
        id: userId,
      },
      select: {
        totpSecret: true,
        totpActive: true,
      },
    });
    //todo: ist das hier richtig?
    if (user === null) throw new BadRequestException('User not found.');
    if (user.totpSecret === null) throw new BadRequestException('No TOTP set.');
    const isValid = await verifyTOTP(user.totpSecret, otp);
    if (isValid) {
      await this.prisma.users.update({
        where: {
          id: userId,
        },
        data: {
          totpActive: true,
        },
      });
    } else {
      throw new BadRequestException('TOTP code is invalid.');
    }
    return successResponse(null, 'TOTP verified and activated successfully.');
  }

  async deleteTOTP(userId: number) {
    await this.prisma.users.update({
      where: {
        id: userId,
      },
      data: {
        totpSecret: null,
        totpActive: false,
      },
    });
    return successResponse(null, 'TOTP deleted.');
  }
}
