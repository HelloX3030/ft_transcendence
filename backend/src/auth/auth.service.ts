import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { LoginDto, RegisterDto } from './dto';
import * as argon2 from 'argon2';
import { PrismaService } from 'src/prisma/prisma.service';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { JwtService } from '@nestjs/jwt';
import { randomBytes } from 'crypto';
import { JwtRefreshPayload, JwtTokens } from 'src/types';
import type { Response as ExpressResponse, Request as ExpressRequest } from 'express';
import { Interval } from '@nestjs/schedule';
import { successResponse } from 'src/utils';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  async register(req: ExpressRequest, dto: RegisterDto, res: ExpressResponse) {
    const hash = await argon2.hash(dto.password);

    try {
      const user = await this.prisma.users.create({
        data: {
          username: dto.username,
          email: dto.email,
          password: hash,
          language: dto.language,
          role: 'user',
          totpActive: false,
        },
      });
      const tokens = await this.createJwt(user.id, user.email, req);
      this.setCookies(tokens, res);
      return successResponse(null, 'User registered successfully');
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ForbiddenException('Credentials taken');
        }
      }
      throw error;
    }
  }

  async login(req: ExpressRequest, dto: LoginDto, res: ExpressResponse) {
    const user = await this.prisma.users.findUnique({
      where: { email: dto.email },
    });
    if (user === null || user.password === undefined)
      throw new ForbiddenException('Invalid credentials');

    const isPwMatch = await argon2.verify(user.password, dto.password);
    if (!isPwMatch) {
      throw new ForbiddenException('Invalid credentials');
    }

    const tokens = await this.createJwt(user.id, user.email, req);
    this.setCookies(tokens, res);
    return successResponse(null, 'Login successful');
  }

  async refresh(payload: JwtRefreshPayload, res: ExpressResponse) {
    const session = await this.prisma.sessions.findUnique({
      where: {
        id: payload.sessionId,
      },
    });
    if (session === null) {
      console.error('could not find the session in the database to issue a new JWT');
      throw new ForbiddenException('Invalid session id');
    }

    const isMatch = await argon2.verify(session.sessionHash, payload.session);
    if (!isMatch) {
      throw new ForbiddenException('Invalid session id');
    }

    const user = await this.prisma.users.findUnique({
      where: {
        id: payload.sub,
      },
    });
    if (user === null) {
      console.error('could not find the user in the database to issue a new JWT');
      throw new InternalServerErrorException();
    }
    const tokens = {
      access_token: (await this.createAccessJwt(user.id, user.email)).access_token,
      refresh_token: (await this.updateRefreshJwt(user.id, payload.sessionId, payload.session))
        .refresh_token,
    };
    this.setCookies(tokens, res);
    return successResponse(null, 'Token refreshed');
  }

  async logout(payload: JwtRefreshPayload, res: ExpressResponse) {
    await this.prisma.sessions.delete({
      where: {
        id: payload.sessionId,
      },
    });
    res.clearCookie('access_token');
    res.clearCookie('refresh_token');
    return successResponse(null, 'Logged out');
  }

  async createJwt(userId: number, email: string, req: ExpressRequest): Promise<JwtTokens> {
    return {
      access_token: (await this.createAccessJwt(userId, email)).access_token,
      refresh_token: (await this.createRefreshJwt(userId, req)).refresh_token,
    };
  }

  async createAccessJwt(userId: number, email: string): Promise<{ access_token: string }> {
    const payload = {
      sub: userId,
      email: email,
    };

    const token = await this.jwt.signAsync(payload, {
      expiresIn: '15m',
      secret: process.env.JWT_ACCESS_SECRET,
    });

    return {
      access_token: token,
    };
  }

  async createRefreshJwt(userId: number, req: ExpressRequest): Promise<{ refresh_token: string }> {
    const sessionKey = randomBytes(32).toString('hex');
    const sessionHash = await argon2.hash(sessionKey);

    let ip = req.ip?.toString();
    if (ip === undefined) throw new BadRequestException();
    if (ip.startsWith('::ffff:')) {
      ip = ip.replace('::ffff:', '');
    }

    const session = await this.prisma.sessions.create({
      data: {
        userId: userId,
        sessionHash: sessionHash,
        ipAddress: ip,
        userAgent: req.headers['user-agent'] || 'unknown',
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 15),
      },
    });

    const payload = {
      sub: userId,
      sessionId: session.id,
      session: sessionKey,
    };

    const token = await this.jwt.signAsync(payload, {
      expiresIn: '15d',
      secret: process.env.JWT_REFRESH_SECRET,
    });

    return {
      refresh_token: token,
    };
  }

  async updateRefreshJwt(
    userId: number,
    sessionId: number,
    sessionKey: string,
  ): Promise<{ refresh_token: string }> {
    await this.prisma.sessions.update({
      where: {
        id: sessionId,
      },
      data: {
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 15),
      },
    });

    const payload = {
      sub: userId,
      sessionId: sessionId,
      session: sessionKey,
    };

    const token = await this.jwt.signAsync(payload, {
      expiresIn: '15d',
      secret: process.env.JWT_REFRESH_SECRET,
    });

    return {
      refresh_token: token,
    };
  }

  setCookies(tokens: JwtTokens, res: ExpressResponse) {
    res.cookie('access_token', tokens.access_token, {
      httpOnly: true,
      secure: false, // todo: set to true
      sameSite: 'strict',
      maxAge: 1000 * 60 * 15,
    });

    res.cookie('refresh_token', tokens.refresh_token, {
      httpOnly: true,
      secure: false, // todo: set to true
      sameSite: 'strict',
      maxAge: 1000 * 60 * 60 * 24 * 15,
    });
  }

  @Interval(300000) // every 5 min
  async sessionCleanUp() {
    console.log('Run session clean up');
    try {
      await this.prisma.sessions.deleteMany({
        where: {
          expiresAt: {
            lt: new Date(),
          },
        },
      });
    } catch (error) {
      console.error(error);
    }
  }
}
