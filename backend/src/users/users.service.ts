import { Prisma } from '@prisma/client';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { PrismaService } from 'src/prisma/prisma.service';
import { StorageService } from 'src/storage/storage.service';
import * as crypto from 'crypto';
import {
  ALLOWED_IMAGE_LABEL,
  detectImageType,
  encryptSecret,
  mapWithConcurrency,
  successResponse,
} from 'src/utils';
import { TmdbService } from 'src/tmdb/tmdb.service';
import { derivePreferences, OnboardingLimits } from './onboarding-preferences';
import { verifyTOTP } from 'src/utils/otp.utils';
import QRCode from 'qrcode';
import * as OTPAuth from 'otpauth';
import { OnboardingDto, SearchUsersDto, UpdateUserDto } from './dto';
import { APP_NAME, TmdbMovieDetail } from '@cinemates/shared';

/** `files.original_name` is VarChar(255) and the value is client-supplied. */
const MAX_ORIGINAL_NAME_LENGTH = 255;

export const ME_SELECT = {
  id: true,
  username: true,
  email: true,
  avatarFileId: true,
  role: true,
  onboardingCompleted: true,
  genreIds: true,
  actorIds: true,
  directorIds: true,
  totpActive: true,
} as const;

// Ten detail calls per onboarding, most of them Redis hits since the user browsed
// these films moments earlier. Matches ENRICH_CONCURRENCY in MoviesService.
const ONBOARDING_CONCURRENCY = 8;

export const PUBLIC_SELECT = {
  id: true,
  username: true,
  avatarFileId: true,
} as const;

// What another user's profile page reads. The preference arrays are taste, not
// identity; email, role and totpActive stay out of every read but ME_SELECT.
export const PROFILE_SELECT = {
  ...PUBLIC_SELECT,
  genreIds: true,
  actorIds: true,
  directorIds: true,
} as const;

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  // Read here rather than at module scope: ConfigModule's validation runs at
  // bootstrap, and module-scope reads happen at import time, before it.
  private readonly limits: OnboardingLimits;

  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
    private tmdb: TmdbService,
  ) {
    this.limits = {
      genres: Number(process.env.ONBOARDING_MAX_GENRES),
      actors: Number(process.env.ONBOARDING_MAX_ACTORS),
      directors: Number(process.env.ONBOARDING_MAX_DIRECTORS),
    };
  }

  async getMe(userId: number) {
    const user = await this.prisma.users.findUnique({
      where: { id: userId },
      select: ME_SELECT,
    });
    if (user === null) throw new NotFoundException('User not found');
    return successResponse(user);
  }

  async completeOnboarding(userId: number, dto: OnboardingDto) {
    // Cheap fail-fast: derivation costs ten TMDB calls. The guarded updateMany
    // below is what decides, since two concurrent calls would both pass this.
    const existing = await this.prisma.users.findUnique({
      where: { id: userId },
      select: { onboardingCompleted: true },
    });
    if (existing === null) throw new NotFoundException('User not found');
    if (existing.onboardingCompleted) throw new ConflictException('Onboarding already completed');

    const movies = await this.fetchPickedMovies(dto.movieIds);
    const preferences = derivePreferences(movies, this.limits);
    this.logger.debug(
      `Onboarding user ${userId} from ${movies.length} movies: ` +
        `${preferences.genreIds.length} genres, ${preferences.actorIds.length} actors, ` +
        `${preferences.directorIds.length} directors`,
    );

    // Guarded on `onboardingCompleted: false` so a repeat call cannot re-stamp
    // the preference arrays.
    const { count } = await this.prisma.users.updateMany({
      where: { id: userId, onboardingCompleted: false },
      data: {
        onboardingCompleted: true,
        ...preferences,
      },
    });

    // updateMany cannot return the row, so read it back; it also tells a
    // deleted user (404) apart from an already-onboarded one (409).
    const user = await this.prisma.users.findUnique({
      where: { id: userId },
      select: ME_SELECT,
    });
    if (user === null) throw new NotFoundException('User not found');
    if (count === 0) throw new ConflictException('Onboarding already completed');

    return successResponse(user);
  }

  /** Details for the picked movies. A retired id is dropped; an outage is not. */
  private async fetchPickedMovies(tmdbIds: number[]): Promise<TmdbMovieDetail[]> {
    const results = await mapWithConcurrency(tmdbIds, ONBOARDING_CONCURRENCY, async (id) => {
      try {
        return (await this.tmdb.getMovieDetail(id)).data;
      } catch (error) {
        // An id TMDB does not know: derive from the other nine rather than fail
        // a signup. Anything else is an outage and must abort, since onboarding
        // is written once and a partial profile would be permanent.
        if (error instanceof NotFoundException) {
          this.logger.warn(`Skipping unresolvable TMDB movie ${id} during onboarding`);
          return null;
        }
        throw error;
      }
    });

    const movies = results.filter((movie): movie is TmdbMovieDetail => movie != null);
    if (movies.length === 0) {
      throw new ServiceUnavailableException(
        'Could not read your picks from TMDB. Please try again.',
      );
    }
    return movies;
  }

  async updateMe(userId: number, dto: UpdateUserDto) {
    try {
      const user = await this.prisma.users.update({
        where: { id: userId },
        data: dto,
        select: ME_SELECT,
      });
      return successResponse(user);
    } catch (error) {
      // Same 409 as PrismaExceptionFilter maps P2002 to everywhere else; caught
      // locally only to name the colliding field.
      if (error instanceof PrismaClientKnownRequestError && error.code === 'P2002') {
        const target = (error.meta?.target as string[]) ?? [];
        if (target.includes('email')) throw new ConflictException('Email already taken');
        throw new ConflictException('Username already taken');
      }
      throw error;
    }
  }

  async uploadAvatar(userId: number, file: Express.Multer.File) {
    // The declared mimetype and the filename are both client-controlled, so the
    // canonical type and the key extension come from the actual bytes. That keeps
    // scriptable formats out of the bucket and the served Content-Type honest.
    const image = detectImageType(file.buffer);
    if (image === null) {
      throw new BadRequestException(`Unsupported image format. Allowed: ${ALLOWED_IMAGE_LABEL}`);
    }

    const current = await this.prisma.users.findUnique({
      where: { id: userId },
      select: { avatarFile: { select: { id: true, key: true } } },
    });
    const previous = current?.avatarFile ?? null;

    // Random suffix: two uploads within the same millisecond would otherwise share a
    // key, and the old-object cleanup below would delete the one just written.
    const key = `${userId}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}${image.ext}`;
    await this.storage.upload(key, file.buffer, image.mime);

    let updated;
    try {
      // One transaction: a `files` row that nothing points at is an orphan, and
      // an `avatarFileId` pointing at a row that was never written is a 404.
      updated = await this.prisma.$transaction(async (tx) => {
        const row = await tx.files.create({
          data: {
            ownerId: userId,
            key,
            mimetype: image.mime,
            size: file.buffer.length,
            originalName: file.originalname.slice(0, MAX_ORIGINAL_NAME_LENGTH),
            kind: 'avatar',
          },
          select: { id: true },
        });
        return tx.users.update({
          where: { id: userId },
          data: { avatarFileId: row.id },
          select: ME_SELECT,
        });
      });
    } catch (error) {
      // The object is in the bucket but nothing references it now, so drop it.
      // `delete` swallows its own failures, so the original error surfaces.
      await this.storage.delete(key);
      throw error;
    }

    // Replacing an avatar still cleans up the one it replaced; the explicit
    // DELETE below is an addition, not a substitute.
    if (previous !== null) await this.discardFile(previous);
    return successResponse(updated);
  }

  /**
   * Detaches and deletes the current avatar, falling the UI back to initials. A
   * user with no avatar gets a 404 rather than a silent no-op, so a stale button
   * cannot report success.
   */
  async deleteAvatar(userId: number) {
    const current = await this.prisma.users.findUnique({
      where: { id: userId },
      select: { avatarFile: { select: { id: true, key: true } } },
    });
    if (current === null) throw new NotFoundException('User not found');
    if (current.avatarFile === null) throw new NotFoundException('No avatar to delete');

    // Deleting the row clears users.avatarFileId through `onDelete: SetNull`, so
    // the reference and the file cannot end up disagreeing.
    await this.discardFile(current.avatarFile);

    const updated = await this.prisma.users.findUnique({
      where: { id: userId },
      select: ME_SELECT,
    });
    if (updated === null) throw new NotFoundException('User not found');
    return successResponse(updated);
  }

  /** Drops a file row and its object. Order matters: the row is the reference. */
  private async discardFile(file: { id: number; key: string }) {
    await this.prisma.files.delete({ where: { id: file.id } });
    await this.storage.delete(file.key);
  }

  async deleteMe(userId: number) {
    // Read the keys before the delete: the rows go with the user (cascade), but
    // the objects in the bucket have no such relationship and would be leaked.
    const files = await this.prisma.files.findMany({
      where: { ownerId: userId },
      select: { key: true },
    });

    await this.prisma.users.delete({ where: { id: userId } });

    for (const { key } of files) await this.storage.delete(key);
    return successResponse(null, 'Account deleted');
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

    return successResponse({ page, limit, total, results });
  }

  async getUser(userId: number) {
    const user = await this.prisma.users.findUnique({
      where: { id: userId },
      select: PUBLIC_SELECT,
    });
    if (user === null) throw new NotFoundException('User not found');
    return successResponse(user);
  }

  /**
   * The profile page's read, kept apart from `getUser` so the lean shape every
   * list surface fetches per member does not grow three arrays it never renders.
   */
  async getUserProfile(userId: number) {
    const user = await this.prisma.users.findUnique({
      where: { id: userId },
      select: PROFILE_SELECT,
    });
    if (user === null) throw new NotFoundException('User not found');
    return successResponse(user);
  }

  async createTOTP(userId: number) {
    const user = await this.prisma.users.findUnique({
      where: {
        id: userId,
      },
      select: {
        username: true,
        totpActive: true,
      },
    });
    if (user === null) throw new NotFoundException('User not found.');

    const totp = new OTPAuth.TOTP({
      issuer: APP_NAME,
      label: user.username,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
    });

    const secret = totp.secret.base32;
    const qrCode = await this.generateQRCode(totp.toString());

    const encryptedSecret = encryptSecret(secret);

    const result = await this.prisma.users.updateMany({
      where: {
        id: userId,
        totpActive: false,
      },
      data: {
        totpSecret: encryptedSecret,
      },
    });
    if (result.count === 0) {
      throw new ConflictException('TOTP setup already in progress or active.');
    }
    return successResponse(qrCode);
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
    if (user === null) throw new NotFoundException('User not found.');
    if (user.totpSecret === null) throw new BadRequestException('No TOTP set.');
    const counter = verifyTOTP(user.totpSecret, otp);
    if (counter === null) {
      throw new BadRequestException('TOTP code is invalid.');
    }

    const result = await this.prisma.users.updateMany({
      where: {
        id: userId,
        totpSecret: user.totpSecret,
        // Without this a re-post of a still-valid code to an already-active
        // account updates the row again and reports success a second time.
        totpActive: false,
      },
      data: {
        totpActive: true,
        // Burn the counter on activation too, so the code that switched TOTP on
        // cannot immediately be replayed against login.
        totpLastCounter: counter,
      },
    });
    if (result.count === 0) {
      throw new ConflictException('TOTP setup already in progress or active.');
    }
    return successResponse(null, 'TOTP verified and activated successfully.');
  }

  /**
   * Turning 2FA off is gated the same way turning it on is. Without the gate,
   * anyone holding a live session obtained by any route that is not a login could
   * remove the second factor in a single request.
   *
   * The gate is a current code rather than the password: Google-only accounts
   * have no password, and the password is the factor TOTP exists to survive.
   */
  async deleteTOTP(userId: number, otp?: string) {
    const user = await this.prisma.users.findUnique({
      where: { id: userId },
      select: { totpSecret: true, totpActive: true },
    });
    if (user === null) throw new NotFoundException('User not found.');

    if (!user.totpActive) {
      // An unconfirmed secret has never guarded anything, and a code cannot be
      // demanded for a QR the user never scanned. It must stay clearable, since
      // createTOTP refuses to replace an existing secret. `totpActive: false` is
      // in the filter so a concurrent activation cannot lose its now-live secret.
      await this.prisma.users.updateMany({
        where: { id: userId, totpActive: false },
        data: { totpSecret: null },
      });
      return successResponse(null, 'TOTP deleted.');
    }

    if (user.totpSecret === null) {
      // Active with no secret is a corrupt row: verifyMfa already refuses such an
      // account, so clearing the flag is the only way out, not a bypass.
      await this.prisma.users.updateMany({
        where: { id: userId, totpActive: true, totpSecret: null },
        data: { totpActive: false },
      });
      return successResponse(null, 'TOTP deleted.');
    }

    if (otp === undefined) throw new BadRequestException('TOTP code is required.');

    const counter = verifyTOTP(user.totpSecret, otp);
    if (counter === null) throw new BadRequestException('TOTP code is invalid.');

    // Same atomic idiom as verifyMfa and activateTOTP: the counter is both filter
    // and payload. A code stays valid for ~90 seconds, and this stops one being
    // spent on a login from also disabling 2FA.
    const { count } = await this.prisma.users.updateMany({
      where: {
        id: userId,
        totpActive: true,
        OR: [{ totpLastCounter: null }, { totpLastCounter: { lt: counter } }],
      },
      data: { totpSecret: null, totpActive: false, totpLastCounter: counter },
    });
    if (count === 0) throw new BadRequestException('TOTP code is invalid.');

    // totpLastCounter is deliberately left set: re-enrolling generates a fresh
    // secret, and clearing it would open a replay window across a disable and
    // re-enable cycle.
    return successResponse(null, 'TOTP deleted.');
  }

  async generateQRCode(uri: string) {
    try {
      const qrCode = await QRCode.toString(uri, { type: 'svg' });
      return qrCode;
    } catch (error) {
      this.logger.error('Error during QR code generation', error as Error);
      throw new InternalServerErrorException();
    }
  }
}
