/**
 * Every date and time the app renders, formatted in one place.
 *
 * The locale is pinned rather than left to `toLocale*`'s default: an unpinned
 * call renders differently on every viewer's machine, so the same screen reads
 * `19/08/2026` here and `8/19/2026` on the next laptop. `en-GB` because the UI
 * is English and the audience is European — day/month/year, 24-hour clock.
 *
 * Independent of the `WATCH_PROVIDER_REGION` in `constants.ts`: this pins how
 * text is written, that pins where the content is watched.
 */
const LOCALE = 'en-GB';

/** Clock time only, for chat bubbles and anything within the current day. */
export function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit' });
}

/** Calendar date, for "created on" and "friends since" lines. */
export function formatDate(iso: string | Date) {
  return new Date(iso).toLocaleDateString(LOCALE, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/** Both, for the notification inbox where the exact moment matters. */
export function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString(LOCALE, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
