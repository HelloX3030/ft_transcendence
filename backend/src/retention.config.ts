/** How long user-generated rows are kept. The daily sweeps read their windows from here. */

/**
 * Read notifications are the bulk of the inbox, so they go first; the longer
 * window bounds growth for rows nobody ever opened.
 */
export const READ_RETENTION_DAYS = 30;
export const MAX_RETENTION_DAYS = 90;

/** Chat transcripts are kept server-side, so the window bounds the exposure. */
export const MESSAGE_RETENTION_DAYS = 90;

/**
 * An upload that no record references is dead weight in the bucket. One day is
 * long enough that a slow but legitimate attach flow is never caught.
 */
export const ORPHAN_FILE_RETENTION_DAYS = 1;

/**
 * Password-reset rows are dead the moment they expire, and keeping them leaves a
 * table of hashes tied to accounts that recently forgot their password.
 */
export const PASSWORD_RESET_RETENTION_DAYS = 1;

export const DAY_MS = 24 * 60 * 60 * 1000;

export function daysAgo(days: number, now: number = Date.now()): Date {
  return new Date(now - days * DAY_MS);
}
