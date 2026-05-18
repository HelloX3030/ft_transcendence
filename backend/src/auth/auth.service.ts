import { ForbiddenException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { LoginDto, RegisterDto } from './dto';
import * as argon2 from 'argon2';
import { PrismaService } from 'src/prisma/prisma.service';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService) {}

  async register(dto: RegisterDto) {
    let hash: string;

    try {
      hash = await argon2.hash(dto.password);
    } catch (error) {
      console.error('argo2 pasword hashing error: ' + error);
      throw new InternalServerErrorException('password hashing failed');
    }

    try {
      const user = await this.prisma.users.create({
        data: {
          username: dto.username,
          email: dto.email,
          password: hash,
          language: dto.language,
          role: 'user',
        },
      });
      console.log(user);
      return 'succsess';
    } catch (error) {
      console.error(error);
      if (error instanceof PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ForbiddenException('Credentials taken');
        }
        if (error.code === 'P2000') {
          throw new ForbiddenException('Provided value for the column is too long');
        }
      }
      throw new InternalServerErrorException('Unexpected error');
    }
  }

  async login(dto: LoginDto) {
    let user = await this.prisma.users.findUnique({
      where: { email: dto.email },
    });
    if (user === null || user.password === undefined)
      throw new ForbiddenException('Invalid credentials');

    try {
      const isPwMatch = await argon2.verify(user.password, dto.password);
      if (!isPwMatch) {
        throw new ForbiddenException('Invalid credentials');
      }
    } catch (error) {
      if (error instanceof ForbiddenException) throw error;
      console.error(error);
      throw new InternalServerErrorException('cout not verify the credentials');
    }
    return 'succsess';
  }
}
