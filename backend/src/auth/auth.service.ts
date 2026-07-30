import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { LoginDto, MfaVerifyDto, RegisterDto } from './dto';
import * as argon2 from 'argon2';
import { PrismaService } from 'src/prisma/prisma.service';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { JwtService } from '@nestjs/jwt';
import { createHmac, randomBytes } from 'crypto';
import { JwtMfaPayload, JwtRefreshPayload, JwtTokens } from 'src/types';
import type { Response as ExpressResponse, Request as ExpressRequest } from 'express';
import { Interval } from '@nestjs/schedule';
import { successResponse } from 'src/utils';
import { verifyTOTP } from 'src/utils/otp.utils';
import { apiResponse, LoginResponse } from '@trailertinder/shared';

/** Long enough to read a code off a phone, short enough to be worth little if stolen. */
const MFA_TOKEN_TTL = '5m';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

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
          // Deliberately generic: does not reveal whether the email or the
          // username collided. See A6 in _meta/reviews/CODE_REVIEW_AUTH_TOTP.md.
          throw new ConflictException('Credentials taken');
        }
      }
      throw error;
    }
  }

  async login(
    req: ExpressRequest,
    dto: LoginDto,
    res: ExpressResponse,
  ): Promise<apiResponse<LoginResponse>> {
    const user = await this.prisma.users.findUnique({
      where: { email: dto.email },
    });
    if (user === null) throw new ForbiddenException('Invalid credentials');

    const isPwMatch = await argon2.verify(user.password, dto.password);
    if (!isPwMatch) {
      throw new ForbiddenException('Invalid credentials');
    }

    if (user.totpActive) {
      if (user.totpSecret === null) {
        this.logger.error('TOTP is enabled, but no totpSecret has been set.');
        throw new InternalServerErrorException();
      }
      // The password is not asked for again. The client holds this token for the
      // OTP step instead, so the password crosses the wire once per login.
      return successResponse(
        { mfaRequired: true, mfaType: 'totp', mfaToken: await this.createMfaToken(user.id) },
        'TOTP is required for login.',
      );
    }

    const tokens = await this.createJwt(user.id, user.email, req);
    this.setCookies(tokens, res);
    return successResponse({ mfaRequired: false, mfaType: 'none' }, 'Login successful');
  }

  /**
   * Second step of an MFA login: exchanges the challenge token plus a valid OTP
   * for a session. Every failure answers the same way, so this cannot be used to
   * tell a valid challenge token from an invalid one.
   */
  async verifyMfa(
    req: ExpressRequest,
    dto: MfaVerifyDto,
    res: ExpressResponse,
  ): Promise<apiResponse<LoginResponse>> {
    const userId = await this.readMfaToken(dto.mfaToken);

    const user = await this.prisma.users.findUnique({ where: { id: userId } });
    // The account can be deleted, or TOTP turned off, between the two steps.
    if (user === null || !user.totpActive || user.totpSecret === null) {
      throw new ForbiddenException('Invalid TOTP');
    }

    const counter = verifyTOTP(user.totpSecret, dto.otp);
    if (counter === null) throw new ForbiddenException('Invalid TOTP');

    // A code stays valid across three time steps, so spending it has to be
    // recorded or a captured one can be replayed for the rest of that span.
    // updateMany with the counter in the filter makes the check and the write
    // one atomic statement, so two racing logins cannot both consume it.
    const { count } = await this.prisma.users.updateMany({
      where: {
        id: user.id,
        OR: [{ totpLastCounter: null }, { totpLastCounter: { lt: counter } }],
      },
      data: { totpLastCounter: counter },
    });
    if (count === 0) throw new ForbiddenException('Invalid TOTP');

    const tokens = await this.createJwt(user.id, user.email, req);
    this.setCookies(tokens, res);
    return successResponse({ mfaRequired: false, mfaType: 'none' }, 'Login successful');
  }

  /**
   * Key for the MFA challenge tokens.
   *
   * Derived from the access secret rather than configured separately, so no new
   * env var is needed, but domain-separated by the HMAC label: a challenge token
   * can never validate as an access token, which matters because it is issued
   * before the second factor has been supplied.
   */
  private mfaTokenSecret(): string {
    return createHmac('sha256', process.env.JWT_ACCESS_SECRET ?? '')
      .update('mfa-challenge-token')
      .digest('hex');
  }

  private createMfaToken(userId: number): Promise<string> {
    const payload: JwtMfaPayload = { sub: userId, purpose: 'mfa' };
    return this.jwt.signAsync(payload, {
      secret: this.mfaTokenSecret(),
      expiresIn: MFA_TOKEN_TTL,
    });
  }

  private async readMfaToken(token: string): Promise<number> {
    try {
      const payload = await this.jwt.verifyAsync<JwtMfaPayload>(token, {
        secret: this.mfaTokenSecret(),
      });
      // Belt and braces: the derived key already rules out other token types.
      if (payload.purpose !== 'mfa') throw new Error('Not an MFA challenge token.');
      return payload.sub;
    } catch {
      throw new ForbiddenException('Invalid TOTP');
    }
  }

  async refresh(payload: JwtRefreshPayload, res: ExpressResponse) {
    const session = await this.prisma.sessions.findUnique({
      where: {
        id: payload.sessionId,
      },
    });
    if (session === null) {
      this.logger.error('could not find the session in the database to issue a new JWT');
      throw new ForbiddenException('Invalid session id');
    }

    const isMatch = await argon2.verify(session.sessionHash, payload.session);
    if (!isMatch) {
      throw new ForbiddenException('Invalid session id');
    }

    if (session.userId !== payload.sub) {
      this.logger.error('refresh token subject does not match the owner of the session');
      throw new ForbiddenException('Invalid session id');
    }

    const user = await this.prisma.users.findUnique({
      where: {
        id: session.userId,
      },
    });
    if (user === null) {
      this.logger.error('could not find the user in the database to issue a new JWT');
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
    // `req.secure` reads the X-Forwarded-Proto that Caddy sets (see the
    // `trust proxy` setting in main.ts), so in the running app — where the
    // browser only ever arrives over HTTPS — both cookies are always Secure.
    // Hardcoding `true` would be equivalent there, but would make the cookies
    // undeliverable over the plain-HTTP in-network requests the e2e suite
    // makes, hiding the whole auth flow from the tests.
    // `sameSite: 'strict'` is now literally same-origin, not merely same-site.
    const secure = res.req.secure;

    res.cookie('access_token', tokens.access_token, {
      httpOnly: true,
      secure,
      sameSite: 'strict',
      maxAge: 1000 * 60 * 15,
    });

    res.cookie('refresh_token', tokens.refresh_token, {
      httpOnly: true,
      secure,
      sameSite: 'strict',
      maxAge: 1000 * 60 * 60 * 24 * 15,
    });
  }

  @Interval(300000) // every 5 min
  async sessionCleanUp() {
    try {
      await this.prisma.sessions.deleteMany({
        where: {
          expiresAt: {
            lt: new Date(),
          },
        },
      });
    } catch (error) {
      this.logger.error('Session cleanup failed', error as Error);
    }
  }
}
