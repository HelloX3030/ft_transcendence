/**
 * Every date and time the app renders. The locale is pinned so the same screen
 * cannot read `19/08/2026` here and `8/19/2026` on the next machine.
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
