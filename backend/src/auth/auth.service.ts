import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ForgotPasswordDto, LoginDto, MfaVerifyDto, RegisterDto, ResetPasswordDto } from './dto';
import * as argon2 from 'argon2';
import { PrismaService } from 'src/prisma/prisma.service';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { JwtService } from '@nestjs/jwt';
import { createHash, createHmac, randomBytes, randomInt } from 'crypto';
import { MailService } from 'src/mail/mail.service';
import { RedisService } from 'src/redis/redis.service';
import { DAY_MS, daysAgo, PASSWORD_RESET_RETENTION_DAYS } from 'src/retention.config';
import { GoogleProfile, JwtMfaPayload, JwtRefreshPayload, JwtTokens } from 'src/types';
import { language_code } from '@prisma/client';
import type { Response as ExpressResponse, Request as ExpressRequest } from 'express';
import { Interval } from '@nestjs/schedule';
import { successResponse } from 'src/utils';
import { verifyTOTP } from 'src/utils/otp.utils';
import { apiResponse, LoginResponse } from '@trailertinder/shared';

/** Long enough to read a code off a phone, short enough to be worth little if stolen. */
const MFA_TOKEN_TTL = '5m';
const MFA_TOKEN_TTL_MS = 1000 * 60 * 5;

/** Carries the MFA challenge across the Google redirect, where no body exists. */
const MFA_COOKIE = 'mfa_token';
/** Carries the OAuth CSRF state between the two legs of the redirect flow. */
const STATE_COOKIE = 'oauth_state';
const STATE_TTL_MS = 1000 * 60 * 10;

/**
 * Long enough to walk away from the machine, short enough that a link sitting
 * in an inbox is not a standing key.
 */
const RESET_TOKEN_TTL_MS = 1000 * 60 * 30;
/** Per-email, so rotating addresses cannot flood one victim's inbox past the IP throttle. */
const RESET_COOLDOWN_SECONDS = 60;

/**
 * Generated usernames are padded to 6 rather than the backend's own minimum of
 * 3: the frontend's registerSchema/userEditSchema require 6, so a shorter name
 * would leave a Google user on a profile form they cannot save. The two limits
 * disagreeing is a known defect tracked separately; padding to the stricter one
 * is valid under either.
 */
const GENERATED_USERNAME_MIN = 6;
/** Leaves room for a 4-digit collision suffix inside the column's 32 chars. */
const GENERATED_USERNAME_STEM_MAX = 28;
const USERNAME_ATTEMPTS = 5;

/** Error codes the callback redirects with; the frontend maps them to copy. */
export type GoogleAuthError =
  | 'email_taken'
  | 'unverified_email'
  | 'state_mismatch'
  | 'provider_error';

export class GoogleAuthException extends Error {
  constructor(readonly code: GoogleAuthError) {
    super(code);
  }
}

function readCookie(req: ExpressRequest, name: string): string | null {
  const cookies = req.cookies as Record<string, unknown> | undefined;
  const value = cookies?.[name];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/** SHA-256, per the reasoning on `password_resets.tokenHash` in the schema. */
export function hashResetToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Drops every session a user has, so their outstanding refresh tokens all fail
 * at `sessions.findUnique` and the frontend bounces them to /login.
 *
 * Takes a transaction client so it can be part of a larger atomic change. Kept
 * separate because three callers want exactly this: the password reset here, a
 * future `PATCH /users/me/password`, and any "log out everywhere" control — one
 * implementation, one place to be correct.
 */
export function revokeAllSessions(
  tx: Pick<PrismaService, 'sessions'>,
  userId: number,
): Promise<{ count: number }> {
  return tx.sessions.deleteMany({ where: { userId } });
}

/**
 * Google has no username to give us, so one is derived from the email: local
 * part, lowercased, stripped to `[a-z0-9_]`, padded to the minimum and cut to
 * leave room for a collision suffix.
 */
export function generateUsernameStem(email: string): string {
  const local = email.split('@')[0] ?? '';
  const cleaned = local.toLowerCase().replace(/[^a-z0-9_]/g, '');

  // An address whose local part is entirely stripped (all-unicode, say) would
  // otherwise pad to "uuuuuu" for everyone; "user" keeps it recognisable and
  // the suffix retry still separates them.
  const base = cleaned.length > 0 ? cleaned : 'user';

  return base.padEnd(GENERATED_USERNAME_MIN, '0').slice(0, GENERATED_USERNAME_STEM_MAX);
}

function randomSuffix(): string {
  // randomInt over Math.random: the suffix is short, and a predictable one lets
  // an attacker sit on the names the next signup will be offered.
  return randomInt(1000, 10000).toString();
}

/** True when a P2002 names `username`, as opposed to `email` or `google_id`. */
function targetsUsername(error: PrismaClientKnownRequestError): boolean {
  const target = error.meta?.target;
  if (Array.isArray(target)) return target.includes('username');
  return typeof target === 'string' && target.includes('username');
}

/**
 * `language_code` is non-null with no default, so a value is always required.
 * Google's locale is a BCP-47 tag ("de-DE"); only the prefix is of interest.
 */
function mapLocale(locale: string | undefined): language_code {
  const prefix = locale?.split('-')[0];
  if (prefix === 'de' || prefix === 'es') return prefix;
  return 'en';
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private mail: MailService,
    private redis: RedisService,
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

    // Google-only accounts have no local password. argon2.verify on a null hash
    // throws a raw error, which the global filter turns into a 500 — so this
    // check is the difference between a clean 403 and a stack trace.
    if (user.password === null) throw new ForbiddenException('Invalid credentials');

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
    // The password flow puts the token in the body; the Google flow cannot,
    // because it arrives by redirect, so it leaves it in an httpOnly cookie.
    const token = dto.mfaToken ?? readCookie(req, MFA_COOKIE);
    if (token === null) throw new ForbiddenException('Invalid TOTP');

    const userId = await this.readMfaToken(token);

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
    // The Google path may have left this behind; the password path never sets
    // it. Either way the challenge has been spent.
    res.clearCookie(MFA_COOKIE);
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

  // --- Password reset -------------------------------------------------------

  /**
   * Starts a reset. Answers the same 200 whatever happened, because a different
   * response for a known and an unknown address turns this into an
   * account-existence oracle — the same position `register` already takes with
   * its deliberately vague "Credentials taken".
   *
   * The mail is sent *after* the response for the same reason: awaiting SMTP
   * would leak through the response latency what the body refuses to say.
   */
  async forgotPassword(dto: ForgotPasswordDto): Promise<apiResponse<null>> {
    const generic = successResponse(
      null,
      'If an account exists for that address, a reset link is on its way.',
    );

    const user = await this.prisma.users.findUnique({ where: { email: dto.email } });
    if (user === null) return generic;

    // The IP throttle does not stop someone flooding one inbox from rotating
    // addresses, so the cooldown is per email. Fail-open when Redis is down:
    // blocking password resets on a cache outage is worse than the flood.
    const cooldownKey = `pwreset:cooldown:${user.id}`;
    if ((await this.redis.get(cooldownKey)) !== null) return generic;
    await this.redis.set(cooldownKey, '1', RESET_COOLDOWN_SECONDS);

    // A Google-only account has no password to reset. Saying so beats letting
    // them wait for a mail that would never explain itself.
    if (user.password === null) {
      this.mail.sendInBackground(
        user.email,
        'Signing in to CineMates',
        'You asked to reset your password, but this account signs in with Google — ' +
          'there is no password to reset.\n\n' +
          'Use the "Continue with Google" button on the login page.',
      );
      return generic;
    }

    const token = randomBytes(32).toString('base64url');

    // Three "it didn't arrive" clicks must not leave three live links.
    await this.prisma.$transaction([
      this.prisma.password_resets.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: new Date() },
      }),
      this.prisma.password_resets.create({
        data: {
          userId: user.id,
          tokenHash: hashResetToken(token),
          expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
        },
      }),
    ]);

    const link = `${process.env.CORS_ORIGIN ?? ''}/reset-password?token=${token}`;
    this.mail.sendInBackground(
      user.email,
      'Reset your CineMates password',
      `Someone asked to reset the password for this account.\n\n${link}\n\n` +
        'The link is good for 30 minutes and can be used once. ' +
        'If this was not you, ignore this mail — nothing has changed.',
    );

    return generic;
  }

  /**
   * Completes a reset. The password write, the token consumption and the
   * session purge are one transaction: a password written without the token
   * being consumed leaves a reusable link, and a token consumed without the
   * password written locks the user out of their own account.
   */
  async resetPassword(dto: ResetPasswordDto): Promise<apiResponse<null>> {
    const record = await this.prisma.password_resets.findUnique({
      where: { tokenHash: hashResetToken(dto.token) },
      include: { user: true },
    });

    // Unknown, already spent and expired answer identically. Telling them apart
    // would confirm that a token was once real, and for whom.
    if (record === null || record.usedAt !== null || record.expiresAt < new Date()) {
      throw new BadRequestException('This reset link is invalid or has expired');
    }

    // Only after the token is known good. Answering "this account has 2FA" for
    // an invalid token would leak account state to anyone guessing tokens.
    if (record.user.totpActive) {
      await this.verifyResetOtp(record.user, dto.otp);
    }

    const hash = await argon2.hash(dto.password);

    await this.prisma.$transaction(async (tx) => {
      await tx.users.update({ where: { id: record.userId }, data: { password: hash } });
      await tx.password_resets.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      });
      // The security payload of the whole feature: a reset that leaves existing
      // sessions alive does not evict whoever caused the reset.
      await revokeAllSessions(tx, record.userId);
    });

    // Deliberately not logged in. Auto-login would mean access to a mailbox
    // alone produces a session, and it hides whether the new password works.
    return successResponse(null, 'Password updated. You can now log in.');
  }

  /**
   * The TOTP check for a reset. Without it a reset link turns email access into
   * full account access, and the second factor — which exists precisely to
   * survive a compromised password — is bypassed by password recovery.
   */
  private async verifyResetOtp(
    user: { id: number; totpSecret: string | null },
    otp: string | undefined,
  ): Promise<void> {
    if (user.totpSecret === null) {
      this.logger.error('TOTP is enabled, but no totpSecret has been set.');
      throw new InternalServerErrorException();
    }

    if (otp === undefined) {
      throw new ForbiddenException({
        message: 'A one-time code is required to reset this password',
        mfaRequired: true,
      });
    }

    const counter = verifyTOTP(user.totpSecret, otp);
    if (counter === null) throw new BadRequestException('Invalid TOTP');

    // Same atomic idiom as verifyMfa: the counter is both filter and payload, so
    // a code cannot be spent twice inside its ~90-second acceptance window.
    const { count } = await this.prisma.users.updateMany({
      where: {
        id: user.id,
        OR: [{ totpLastCounter: null }, { totpLastCounter: { lt: counter } }],
      },
      data: { totpLastCounter: counter },
    });
    if (count === 0) throw new BadRequestException('Invalid TOTP');
  }

  @Interval(DAY_MS)
  async passwordResetCleanUp() {
    try {
      await this.prisma.password_resets.deleteMany({
        where: { expiresAt: { lt: daysAgo(PASSWORD_RESET_RETENTION_DAYS) } },
      });
    } catch (error) {
      this.logger.error('Password reset cleanup failed', error as Error);
    }
  }

  // --- Google OAuth ---------------------------------------------------------

  /**
   * Issues the CSRF `state` for an outgoing authorization request.
   *
   * passport-google-oauth20 can do this itself, but only by stashing the value
   * in a server-side session, and this app is stateless JWT-in-cookie. Without
   * it the callback would accept any `code`, which is the login-CSRF the
   * parameter exists to prevent.
   *
   * `sameSite: 'lax'` because it has to survive the cross-site navigation back
   * from Google — `strict` would withhold it exactly when it is needed.
   */
  issueGoogleState(res: ExpressResponse): string {
    const state = randomBytes(32).toString('hex');
    res.cookie(STATE_COOKIE, state, {
      httpOnly: true,
      secure: res.req.secure,
      sameSite: 'lax',
      maxAge: STATE_TTL_MS,
    });
    return state;
  }

  /**
   * Compares the `state` Google echoed back against the cookie, and clears it
   * either way so a value can never be replayed.
   */
  verifyGoogleState(req: ExpressRequest, res: ExpressResponse): void {
    const expected = readCookie(req, STATE_COOKIE);
    const actual = typeof req.query.state === 'string' ? req.query.state : null;
    res.clearCookie(STATE_COOKIE);

    if (expected === null || actual === null || expected !== actual) {
      throw new GoogleAuthException('state_mismatch');
    }
  }

  /**
   * Resolves a Google identity to a session, in the order set by Spec 05 §2.3:
   * known googleId → verified email match (link) → unverified email match
   * (reject) → new account.
   *
   * Returns whether a second factor is still owed, so the caller can redirect
   * to the OTP step rather than a finished session.
   */
  async googleLogin(
    req: ExpressRequest,
    profile: GoogleProfile,
    res: ExpressResponse,
  ): Promise<{ mfaRequired: boolean }> {
    const user = await this.resolveGoogleUser(profile);

    if (user.totpActive) {
      if (user.totpSecret === null) {
        this.logger.error('TOTP is enabled, but no totpSecret has been set.');
        throw new GoogleAuthException('provider_error');
      }
      // A compromised Google account must not bypass the second factor. The
      // challenge goes in a cookie, not the URL: a redirect target lands in
      // browser history, in the Referer of anything the page loads, and in any
      // proxy log along the way.
      res.cookie(MFA_COOKIE, await this.createMfaToken(user.id), {
        httpOnly: true,
        secure: res.req.secure,
        sameSite: 'lax',
        maxAge: MFA_TOKEN_TTL_MS,
      });
      return { mfaRequired: true };
    }

    const tokens = await this.createJwt(user.id, user.email, req);
    this.setCookies(tokens, res);
    return { mfaRequired: false };
  }

  /**
   * Terminates the callback. Every outcome is a redirect to the frontend's
   * `/auth/callback`, because a redirect has no JSON body for a client to read.
   *
   * That landing route needs no authentication, which is what makes the session
   * cookies work: they are `sameSite: 'strict'`, so they may not ride along on
   * the cross-site navigation that arrives here. The SPA renders from the Vite
   * shell and then calls `/auth/me` — a same-origin fetch, where the cookies are
   * sent normally. Redirecting straight to `/` appears to work in some browsers
   * and fails in others.
   */
  async googleCallback(
    req: ExpressRequest,
    profile: GoogleProfile,
    res: ExpressResponse,
  ): Promise<void> {
    const base = `${process.env.CORS_ORIGIN ?? ''}/auth/callback`;

    try {
      const { mfaRequired } = await this.googleLogin(req, profile, res);
      res.redirect(mfaRequired ? `${base}?mfa=1` : base);
    } catch (error) {
      // GoogleAuthException already names a cause the frontend can render, and
      // GoogleAuthExceptionFilter redirects it. Anything else is ours to log and
      // to reduce to a generic code, so no provider detail reaches the URL.
      if (error instanceof GoogleAuthException) throw error;
      this.logger.error('Google callback failed', error as Error);
      throw new GoogleAuthException('provider_error');
    }
  }

  private async resolveGoogleUser(profile: GoogleProfile) {
    const byGoogleId = await this.prisma.users.findUnique({
      where: { googleId: profile.googleId },
    });
    if (byGoogleId !== null) return byGoogleId;

    const byEmail = await this.prisma.users.findUnique({ where: { email: profile.email } });
    if (byEmail !== null) {
      // Already linked to a different Google account: never overwrite that.
      if (byEmail.googleId !== null) throw new GoogleAuthException('email_taken');

      // Linking on an unverified address is an account-takeover primitive —
      // anyone able to set an arbitrary unverified email on a provider profile
      // could otherwise claim someone else's account here.
      if (!profile.emailVerified) throw new GoogleAuthException('unverified_email');

      return this.prisma.users.update({
        where: { id: byEmail.id },
        data: { googleId: profile.googleId },
      });
    }

    return this.createGoogleUser(profile);
  }

  private async createGoogleUser(profile: GoogleProfile) {
    const stem = generateUsernameStem(profile.email);

    for (let attempt = 0; attempt < USERNAME_ATTEMPTS; attempt++) {
      // The clean stem first, so the large majority of signups never see a
      // digit. Each retry draws a fresh random suffix rather than deriving one
      // from a count: a count is not a high-water mark (deleted accounts, and
      // usernames set by hand, both push it out of step with what is free) and
      // recomputing it yields the same name, so the loop would never progress.
      const username = attempt === 0 ? stem : `${stem}${randomSuffix()}`;

      try {
        return await this.prisma.users.create({
          data: {
            username,
            email: profile.email,
            password: null,
            googleId: profile.googleId,
            language: mapLocale(profile.locale),
            role: 'user',
            totpActive: false,
          },
        });
      } catch (error) {
        if (
          error instanceof PrismaClientKnownRequestError &&
          error.code === 'P2002' &&
          targetsUsername(error)
        ) {
          continue;
        }
        throw error;
      }
    }

    this.logger.error(`Could not find a free username for stem "${stem}"`);
    throw new InternalServerErrorException();
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
