import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { file_kind } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { StorageService, StoredObject } from 'src/storage/storage.service';
import { successResponse } from 'src/utils';
import { daysAgo, ORPHAN_FILE_RETENTION_DAYS } from 'src/retention.config';

/** Everything the controller needs to write the response headers. */
export interface FileDownload extends StoredObject {
  mimetype: string;
}

@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  /**
   * Who may read a file, by kind. Deliberately per-kind from the start: these
   * files are not equally sensitive, and a single blanket rule would not survive
   * a second kind being added. A kind whose rule depends on who is asking takes
   * the requester and the row here; `avatar` does not, so it does not ask for them.
   */
  private canRead(kind: file_kind): boolean {
    switch (kind) {
      // Avatars appear on profiles, friend lists and chat headers, so any signed-in
      // user may read one. Unauthenticated requests never reach here: the global
      // JwtAccessGuard rejects them with a 401 first.
      case file_kind.avatar:
        return true;
    }
  }

  async read(id: number): Promise<FileDownload> {
    const file = await this.prisma.files.findUnique({
      where: { id },
      select: { key: true, mimetype: true, kind: true },
    });
    if (file === null) throw new NotFoundException('File not found');

    if (!this.canRead(file.kind)) {
      throw new ForbiddenException('You may not access this file');
    }

    const object = await this.storage.getObject(file.key);
    return { ...object, mimetype: file.mimetype };
  }

  /**
   * Owner-only. `onDelete: SetNull` clears `users.avatarFileId` as part of the row
   * delete, so the reference and the file cannot end up disagreeing.
   */
  async remove(id: number, requesterId: number) {
    const file = await this.prisma.files.findUnique({
      where: { id },
      select: { key: true, ownerId: true },
    });
    if (file === null) throw new NotFoundException('File not found');
    if (file.ownerId !== requesterId) {
      throw new ForbiddenException('You may not delete this file');
    }

    await this.prisma.files.delete({ where: { id } });
    // Row removal is what matters; deleting an object that is already gone is
    // not an error (`StorageService.delete` swallows its own failures).
    await this.storage.delete(file.key);

    return successResponse(null, 'File deleted');
  }

  /**
   * A file can be uploaded and never attached: the user closes the dialog
   * mid-flow, or a DB write fails in a way the inline cleanup missed. Nothing
   * references those rows, so nothing will ever delete them without this sweep.
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async purgeOrphans() {
    try {
      const orphans = await this.prisma.files.findMany({
        where: {
          createdAt: { lt: daysAgo(ORPHAN_FILE_RETENTION_DAYS) },
          avatarOf: { none: {} },
        },
        select: { id: true, key: true },
      });
      if (orphans.length === 0) return;

      await this.prisma.files.deleteMany({ where: { id: { in: orphans.map(({ id }) => id) } } });
      for (const { key } of orphans) await this.storage.delete(key);

      this.logger.log(`Retention: deleted ${orphans.length} orphaned file(s)`);
    } catch (error) {
      this.logger.error('File retention sweep failed', error as Error);
    }
  }
}
