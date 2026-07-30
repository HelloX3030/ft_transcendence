import { Prisma } from '@prisma/client';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { PrismaService } from 'src/prisma/prisma.service';
import { StorageService } from 'src/storage/storage.service';
import * as crypto from 'crypto';
import { ALLOWED_IMAGE_LABEL, detectImageType, encryptSecret, successResponse } from 'src/utils';
import { verifyTOTP } from 'src/utils/otp.utils';
import QRCode from 'qrcode';
import * as OTPAuth from 'otpauth';
import { OnboardingDto, SearchUsersDto, UpdateUserDto } from './dto';

/** `files.original_name` is VarChar(255) and the value is client-supplied. */
const MAX_ORIGINAL_NAME_LENGTH = 255;

export const ME_SELECT = {
  id: true,
  username: true,
  email: true,
  avatarFileId: true,
  language: true,
  role: true,
  onboardingCompleted: true,
  genreIds: true,
  actorIds: true,
  directorIds: true,
  totpActive: true,
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
  avatarFileId: true,
} as const;

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
  ) {}

  async getMe(userId: number) {
    const user = await this.prisma.users.findUnique({
      where: { id: userId },
      select: ME_SELECT,
    });
    if (user === null) throw new NotFoundException('User not found');
    return successResponse(user);
  }

  async completeOnboarding(userId: number, dto: OnboardingDto) {
    // dto.movieIds is accepted and validated now; deriving real preferences from it
    // is a TODO. For now we mark onboarding done and stamp mock preferences.
    this.logger.debug(
      `Onboarding user ${userId} with ${dto.movieIds.length} movies — applying mock preferences`,
    );
    // Guarded on `onboardingCompleted: false` so a repeat call cannot re-stamp the
    // preference arrays — once real preference extraction exists, whatever it wrote
    // must never be clobbered from this path.
    const { count } = await this.prisma.users.updateMany({
      where: { id: userId, onboardingCompleted: false },
      data: {
        onboardingCompleted: true,
        genreIds: MOCK_ONBOARDING_GENRE_IDS,
        actorIds: MOCK_ONBOARDING_ACTOR_IDS,
        directorIds: MOCK_ONBOARDING_DIRECTOR_IDS,
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
    // The declared mimetype and the filename are both client-controlled, so
    // neither decides what we store: the canonical type and the key extension
    // come from the actual bytes. This is also what keeps scriptable formats
    // (SVG, HTML) out of the bucket, and what makes the Content-Type we serve
    // from GET /files/:id trustworthy.
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
      // an `avatarFileId` pointing at a row that was never written is a 404 on
      // every avatar the user has.
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
      // The object is already in the bucket but nothing references it now — drop it
      // rather than leak it. `delete` swallows its own failures, so the original
      // error is what surfaces.
      await this.storage.delete(key);
      throw error;
    }

    // Replacing an avatar still cleans up the one it replaced; the explicit
    // DELETE below is an addition, not a substitute.
    if (previous !== null) await this.discardFile(previous);
    return successResponse(updated);
  }

  /**
   * Detaches and deletes the current avatar, falling the UI back to initials.
   * Idempotent-ish: a user with no avatar gets a 404 rather than a silent no-op,
   * so a stale button does not report success it did not achieve.
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
    // Read the keys before the delete — the rows go with the user (cascade), but
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

    const appName = process.env.APP_NAME;
    if (appName === undefined) {
      this.logger.error('The env "APP_NAME" is not set.');
      throw new InternalServerErrorException();
    }

    const totp = new OTPAuth.TOTP({
      issuer: appName,
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
