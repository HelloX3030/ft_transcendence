import { BadRequestException } from '@nestjs/common';

/**
 * Keyset pagination cursor.
 *
 * `createdAt` alone is not a total order: two rows written in the same
 * millisecond tie, and a tie landing on a page boundary silently drops or
 * duplicates one of them. The `(createdAt, id)` tuple is total and matches the
 * `(…, created_at DESC, id DESC)` indexes, so a page is one index range scan.
 *
 * The wire format is `<epoch-ms>_<id>` and is opaque to the client — it only
 * ever hands back what the server gave it.
 */
export interface Cursor {
  createdAt: Date;
  id: number;
}

const CURSOR_PATTERN = /^(\d{1,15})_(\d{1,15})$/;

export function encodeCursor(row: { createdAt: Date; id: number }): string {
  return `${row.createdAt.getTime()}_${row.id}`;
}

/** Throws 400 rather than letting a malformed cursor reach Prisma as a 500. */
export function decodeCursor(raw: string): Cursor {
  const match = CURSOR_PATTERN.exec(raw);
  if (match === null) throw new BadRequestException('Malformed cursor.');

  const epochMs = Number(match[1]);
  const id = Number(match[2]);
  if (!Number.isSafeInteger(epochMs) || !Number.isSafeInteger(id) || id <= 0) {
    throw new BadRequestException('Malformed cursor.');
  }

  const createdAt = new Date(epochMs);
  if (Number.isNaN(createdAt.getTime())) throw new BadRequestException('Malformed cursor.');

  return { createdAt, id };
}

/**
 * `(createdAt, id) < (cursor.createdAt, cursor.id)` as a Prisma filter.
 *
 * Prisma has no row-value comparison, so the tuple is expanded by hand: strictly
 * older, or the same instant with a smaller id.
 */
export function olderThanCursor(cursor: Cursor) {
  return [
    { createdAt: { lt: cursor.createdAt } },
    { createdAt: cursor.createdAt, id: { lt: cursor.id } },
  ];
}
