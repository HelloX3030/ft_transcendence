/**
 * How long the inbox keeps rows. Read notifications are the bulk of the table
 * and nobody re-reads them, so they go first; the longer window is the backstop
 * that bounds growth for rows nobody ever opened.
 */
export const READ_RETENTION_DAYS = 30;
export const MAX_RETENTION_DAYS = 90;

export const DAY_MS = 24 * 60 * 60 * 1000;

export function daysAgo(days: number, now: number = Date.now()): Date {
  return new Date(now - days * DAY_MS);
}
