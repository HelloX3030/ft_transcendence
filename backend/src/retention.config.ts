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

export const DAY_MS = 24 * 60 * 60 * 1000;

export function daysAgo(days: number, now: number = Date.now()): Date {
  return new Date(now - days * DAY_MS);
}
