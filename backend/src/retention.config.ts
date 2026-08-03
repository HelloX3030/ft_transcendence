/**
 * How long user-generated rows are kept. Everything the daily sweeps delete is
 * configured here rather than inline, so the windows can be read and defended in
 * one place.
 */

/**
 * Read notifications are the bulk of the inbox and nobody re-reads them, so they
 * go first; the longer window is the backstop that bounds growth for rows nobody
 * ever opened.
 */
export const READ_RETENTION_DAYS = 30;
export const MAX_RETENTION_DAYS = 90;

/**
 * Chat transcripts are kept server-side, which is a privacy trade-off; bounding
 * them is what makes "we store your messages" defensible rather than "we store
 * your messages forever".
 */
export const MESSAGE_RETENTION_DAYS = 90;

/**
 * An upload that no record references is dead weight in the bucket. One day is
 * long enough that a slow but legitimate attach flow is never caught, and short
 * enough that abandoned uploads do not accumulate.
 */
export const ORPHAN_FILE_RETENTION_DAYS = 1;

/**
 * Password-reset rows are dead the moment they expire — the token in them is no
 * longer accepted either way, so keeping them buys nothing and leaves a table of
 * hashes tied to accounts that recently forgot their password.
 */
export const PASSWORD_RESET_RETENTION_DAYS = 1;

export const DAY_MS = 24 * 60 * 60 * 1000;

export function daysAgo(days: number, now: number = Date.now()): Date {
  return new Date(now - days * DAY_MS);
}
