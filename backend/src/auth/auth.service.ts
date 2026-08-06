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
import { apiResponse, LoginResponse } from '@cinemates/shared';
import { CANONICAL_ORIGIN, requestOrigin } from 'src/config/origins';

/** Long enough to read a code off a phone, short enough to be worth little if stolen. */
const MFA_TOKEN_TTL = '5m';
const MFA_TOKEN_TTL_MS = 1000 * 60 * 5;

/**
 * Production values for the four session timeouts. Exported so app.module.ts can
 * state the same numbers in its Joi schema without restating them: these are
 * read at module scope, which runs before ConfigModule applies its own defaults,
 * so the fallback has to live here.
 */
export const SESSION_TTL_DEFAULT_SECONDS = {
  ACCESS_TTL_SECONDS: 15 * 60,
  REFRESH_TTL_SECONDS: (15 * DAY_MS) / 1000,
  SESSION_ABSOLUTE_TTL_SECONDS: (30 * DAY_MS) / 1000,
  REFRESH_GRACE_SECONDS: 30,
} as const;

/**
 * The four timeouts are env-driven, but read **once**, here at module scope
 * rather than per request — each stays the single constant its consumers share,
 * so the cookie, the JWT and the database row cannot drift apart.
 *
 * The env vars exist because none of the four can be exercised by hand at the
 * production values, which is exactly why they went unverified. A tester opts
 * into short ones; an untouched checkout behaves as it always did.
 */
function ttlMs(name: keyof typeof SESSION_TTL_DEFAULT_SECONDS): number {
  const raw = process.env[name];
  const seconds = raw === undefined || raw === '' ? SESSION_TTL_DEFAULT_SECONDS[name] : Number(raw);
  return seconds * 1000;
}

/**
 * The idle timeout: how far `expiresAt`, the refresh JWT and the refresh cookie
 * are pushed out on each use. One constant so the three cannot disagree — they
 * used to be four separate "15 day" literals.
 */
const REFRESH_TTL_MS = ttlMs('REFRESH_TTL_SECONDS');

/**
 * The hard stop, measured from `sessions.createdAt`. Without it the sliding
 * window alone means an actively used session never ends: every refresh pushes
 * `expiresAt` out again, and the frontend refreshes every few minutes while a
 * tab is open. "Sessions last 15 days" would describe only an *idle* timeout,
 * and a token stolen from a machine that stays in use would be valid forever.
 */
const ABSOLUTE_SESSION_LIFETIME_MS = ttlMs('SESSION_ABSOLUTE_TTL_SECONDS');

/**
 * How long the pre-rotation key stays acceptable.
 *
 * Rotation and multi-tab browsing conflict: the in-flight refresh is coalesced
 * within one tab, but the cookie is shared across all of them, so two tabs
 * hitting a 401 at the same moment both present the same key and the slower one
 * would be refused while holding a perfectly good, freshly rotated cookie. Two
 * open tabs is not an edge case, so without this the rotation would introduce a
 * routine, unreproducible-looking logout.
 *
 * Generous next to a request that takes milliseconds, far short of anything
 * useful to an attacker who must also have stolen the cookie.
 */
const REFRESH_GRACE_MS = ttlMs('REFRESH_GRACE_SECONDS');

/** Matches the access JWT's own `expiresIn`, so the cookie and the token agree. */
const ACCESS_TTL_MS = ttlMs('ACCESS_TTL_SECONDS');

/**
 * The cookie attributes that decide whether a `clearCookie` matches the
 * `cookie` that set it. Express only clears a cookie when they line up, and the
 * two used to be written out separately — `clearCookie` passed no options at
 * all. `path` and `domain` are what actually decide the match and both default
 * to `/` here, so it very probably worked; "very probably" is the wrong property
 * for the code path that ends a session.
 *
 * `req.secure` reads the X-Forwarded-Proto that Caddy sets (see `trust proxy` in
 * main.ts), so in the running app — where the browser only ever arrives over
 * HTTPS — both cookies are always Secure. Hardcoding `true` would be equivalent
 * there, but would make the cookies undeliverable over the plain-HTTP in-network
 * requests the e2e suite makes, hiding the whole auth flow from the tests.
 *
 * `sameSite: 'strict'` is now literally same-origin, not merely same-site.
 */
function cookieOptions(res: ExpressResponse) {
  return { httpOnly: true, secure: res.req.secure, sameSite: 'strict' as const };
}

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

  /**
   * The token most recently issued for a session, keyed by session id and kept
   * only for the grace window.
   *
   * This is what lets a racing sibling tab converge on the key the winner
   * already holds. The tabs share one cookie, so the two responses race to write
   * it — if the loser were handed a *different* key, the cookie could end up
   * holding one that dies when the grace window closes, and the logout the grace
   * window exists to prevent would simply arrive 15 minutes late. Answering with
   * the winner's own token is the only way both writes leave the same value.
   *
   * The key's plaintext cannot come from the database (it is argon2-hashed), so
   * it is remembered here instead of stored. In-process and short-lived by
   * design: a restart inside the window just falls back to re-signing the key
   * the caller presented, which is correct for the far commoner single-tab case.
   */
  private readonly recentRefresh = new Map<
    number,
    { previousKey: string; token: string; expiresAt: Date; at: number }
  >();

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
      this.setCookies(tokens, res, tokens.refreshExpiresAt);
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
    this.setCookies(tokens, res, tokens.refreshExpiresAt);
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
    this.setCookies(tokens, res, tokens.refreshExpiresAt);
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

    const link = `${CANONICAL_ORIGIN}/reset-password?token=${token}`;
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
    this.setCookies(tokens, res, tokens.refreshExpiresAt);
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
    const base = `${requestOrigin(req)}/auth/callback`;

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

  /**
   * Exchanges a refresh token for a new pair, rotating the session key.
   *
   * The key is rotated on *every* use. Without that, a captured refresh token
   * stayed valid for its full lifetime no matter how many times the legitimate
   * user refreshed — using it did not consume it — and the theft was
   * undetectable, because both parties could keep refreshing forever with
   * nothing ever looking anomalous. It also made the argon2 hashing of the key
   * largely decorative: the value protected at rest was one the client kept
   * handing back in a long-lived cookie.
   */
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

    if (session.userId !== payload.sub) {
      this.logger.error('refresh token subject does not match the owner of the session');
      throw new ForbiddenException('Invalid session id');
    }

    // Enforced here, not left to the 5-minute sweep: the sweep is garbage
    // collection, and a row past its expiry that has not been collected yet
    // would otherwise still mint a fresh pair of tokens.
    if (session.expiresAt.getTime() <= Date.now()) {
      throw new ForbiddenException('Invalid session id');
    }

    const isCurrent = await argon2.verify(session.sessionHash, payload.session);

    // A racing sibling tab, not a replay: answer with the key that already won
    // the race so both tabs converge, without rotating again or extending
    // expiresAt a second time — otherwise two tabs can ping-pong rotations.
    const isGraced = !isCurrent && (await this.matchesGracedKey(session, payload.session));

    if (!isCurrent && !isGraced) {
      // Deliberately not deleting the session. Reuse detection is what rotation
      // buys, but the blast radius of a false positive is logging a legitimate
      // user out of every device, and the false-positive sources are the hard
      // ones to enumerate: a tab restored from bfcache with a stale in-flight
      // request, a browser replaying after sleep, a mobile network retrying.
      // The warning is free and is the data needed before turning it on.
      this.logger.warn(`stale refresh key presented for session ${session.id}`);
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

    // Returns null when a sibling tab rotated this same key first. The graced
    // branch deliberately neither rotates again nor extends expiresAt: doing
    // either would let two tabs ping-pong rotations, and the point is to
    // converge on one key, not to issue a second.
    let refresh = isCurrent ? await this.updateRefreshJwt(user.id, session, payload.session) : null;

    // Either this caller lost the rotation race or it arrived on the key that
    // was just superseded. Both are the same situation seen from different
    // sides, and both are answered with the token the winner received.
    refresh ??= this.replayRecentRefresh(session.id, payload.session);

    // Only reachable if the process restarted inside the grace window, so the
    // winner's token is no longer in memory. Re-signing the presented key beats
    // logging the user out: it is still accepted, just until the window closes.
    refresh ??= await this.signRefreshJwt(user.id, session.id, payload.session, session.expiresAt);

    const tokens = {
      access_token: (await this.createAccessJwt(user.id, user.email)).access_token,
      refresh_token: refresh.refresh_token,
    };
    this.setCookies(tokens, res, refresh.expiresAt);
    return successResponse(null, 'Token refreshed');
  }

  async logout(payload: JwtRefreshPayload, res: ExpressResponse) {
    // deleteMany, not delete: `delete` on a missing row throws P2025, which the
    // Prisma filter turns into a 404 — and a second logout is entirely normal
    // (the session was swept, another tab logged out, the request was retried).
    // Logging out is the operation that should above all be safe to repeat.
    await this.prisma.sessions.deleteMany({
      where: {
        id: payload.sessionId,
      },
    });
    res.clearCookie('access_token', cookieOptions(res));
    res.clearCookie('refresh_token', cookieOptions(res));
    return successResponse(null, 'Logged out');
  }

  async createJwt(
    userId: number,
    email: string,
    req: ExpressRequest,
  ): Promise<JwtTokens & { refreshExpiresAt: Date }> {
    const refresh = await this.createRefreshJwt(userId, req);
    return {
      access_token: (await this.createAccessJwt(userId, email)).access_token,
      refresh_token: refresh.refresh_token,
      refreshExpiresAt: refresh.expiresAt,
    };
  }

  async createAccessJwt(userId: number, email: string): Promise<{ access_token: string }> {
    const payload = {
      sub: userId,
      email: email,
    };

    const token = await this.jwt.signAsync(payload, {
      expiresIn: ACCESS_TTL_MS / 1000,
      secret: process.env.JWT_ACCESS_SECRET,
    });

    return {
      access_token: token,
    };
  }

  async createRefreshJwt(
    userId: number,
    req: ExpressRequest,
  ): Promise<{ refresh_token: string; expiresAt: Date }> {
    const sessionKey = randomBytes(32).toString('hex');
    const sessionHash = await argon2.hash(sessionKey);

    let ip = req.ip?.toString();
    if (ip === undefined) throw new BadRequestException();
    if (ip.startsWith('::ffff:')) {
      ip = ip.replace('::ffff:', '');
    }

    const expiresAt = new Date(Date.now() + REFRESH_TTL_MS);

    const session = await this.prisma.sessions.create({
      data: {
        userId: userId,
        sessionHash: sessionHash,
        ipAddress: ip,
        userAgent: req.headers['user-agent'] || 'unknown',
        expiresAt,
      },
    });

    return this.signRefreshJwt(userId, session.id, sessionKey, expiresAt);
  }

  /**
   * Rotates the session key and slides the expiry, clamped to the absolute cap.
   *
   * The previous hash is kept for the grace window so a sibling tab racing on
   * the same cookie is answered rather than logged out (see REFRESH_GRACE_MS).
   */
  async updateRefreshJwt(
    userId: number,
    session: { id: number; sessionHash: string; createdAt: Date },
    consumedKey: string,
  ): Promise<{ refresh_token: string; expiresAt: Date } | null> {
    const sessionKey = randomBytes(32).toString('hex');
    const sessionHash = await argon2.hash(sessionKey);

    // Sliding window, hard stop at the cap. Re-login is required at most monthly.
    const cap = session.createdAt.getTime() + ABSOLUTE_SESSION_LIFETIME_MS;
    const expiresAt = new Date(Math.min(Date.now() + REFRESH_TTL_MS, cap));
    if (expiresAt.getTime() <= Date.now()) {
      throw new ForbiddenException('Session expired');
    }

    // Conditional on the hash that was read, which makes the read-modify-write
    // atomic. Two tabs refreshing at once genuinely do read the same row —
    // argon2 is deliberately slow, so the window is wide — and if both wrote,
    // the second would overwrite previousHash with the first's *new* hash and
    // strand the first tab on a key that is neither current nor previous.
    const { count } = await this.prisma.sessions.updateMany({
      where: {
        id: session.id,
        sessionHash: session.sessionHash,
      },
      data: {
        sessionHash,
        previousHash: session.sessionHash,
        rotatedAt: new Date(),
        expiresAt,
      },
    });
    if (count === 0) return null;

    const issued = await this.signRefreshJwt(userId, session.id, sessionKey, expiresAt);
    this.rememberRecentRefresh(session.id, consumedKey, issued);
    return issued;
  }

  /**
   * True when the presented key is the one rotated away from, recently enough to
   * be a sibling tab rather than a replay.
   */
  private async matchesGracedKey(
    session: { previousHash: string | null; rotatedAt: Date | null },
    presentedKey: string,
  ): Promise<boolean> {
    const { previousHash, rotatedAt } = session;
    // Truthiness rather than `!== null`: a session that has never rotated has no
    // previous key, and neither column is meaningful without the other.
    if (!previousHash || !rotatedAt) return false;
    if (Date.now() - rotatedAt.getTime() > REFRESH_GRACE_MS) return false;

    return argon2.verify(previousHash, presentedKey);
  }

  /** Records the just-issued token so a racing sibling tab can be handed the same one. */
  private rememberRecentRefresh(
    sessionId: number,
    previousKey: string,
    issued: { refresh_token: string; expiresAt: Date },
  ) {
    const now = Date.now();
    for (const [id, entry] of this.recentRefresh) {
      if (now - entry.at > REFRESH_GRACE_MS) this.recentRefresh.delete(id);
    }
    this.recentRefresh.set(sessionId, {
      previousKey,
      token: issued.refresh_token,
      expiresAt: issued.expiresAt,
      at: now,
    });
  }

  /** The token issued to whoever won the race, if this caller lost the same one. */
  private replayRecentRefresh(
    sessionId: number,
    presentedKey: string,
  ): { refresh_token: string; expiresAt: Date } | null {
    const entry = this.recentRefresh.get(sessionId);
    if (entry === undefined) return null;
    if (entry.previousKey !== presentedKey) return null;
    if (Date.now() - entry.at > REFRESH_GRACE_MS) return null;

    return { refresh_token: entry.token, expiresAt: entry.expiresAt };
  }

  /**
   * Signs the JWT around a key that is already stored. `expiresIn` comes from the
   * row's own expiry rather than a literal, so the token, the cookie and the row
   * always agree — including when the absolute cap has clamped the window.
   */
  private async signRefreshJwt(
    userId: number,
    sessionId: number,
    sessionKey: string,
    expiresAt: Date,
  ): Promise<{ refresh_token: string; expiresAt: Date }> {
    const payload = {
      sub: userId,
      sessionId: sessionId,
      session: sessionKey,
    };

    const token = await this.jwt.signAsync(payload, {
      expiresIn: Math.floor((expiresAt.getTime() - Date.now()) / 1000),
      secret: process.env.JWT_REFRESH_SECRET,
    });

    return {
      refresh_token: token,
      expiresAt,
    };
  }

  setCookies(tokens: JwtTokens, res: ExpressResponse, refreshExpiresAt?: Date) {
    res.cookie('access_token', tokens.access_token, {
      ...cookieOptions(res),
      maxAge: ACCESS_TTL_MS,
    });

    res.cookie('refresh_token', tokens.refresh_token, {
      ...cookieOptions(res),
      maxAge: (refreshExpiresAt?.getTime() ?? Date.now() + REFRESH_TTL_MS) - Date.now(),
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
