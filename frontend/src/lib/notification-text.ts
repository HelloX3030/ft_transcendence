import type { DomainEventType } from '@cinemates/shared';

/**
 * Rendering lives here, not in the database. The backend stores a type plus the
 * values that were true at event time, and this file turns that pair into a
 * sentence. Storing the sentence instead would freeze the wording into the data
 * and need a migration to change a phrase. It also means a notification about a
 * deleted watchlist still renders, since the name came along in `params`.
 */
export type NotificationParams = Record<string, string>;

/** Placeholders keep a sentence grammatical when a param is missing. */
const actor = (params: NotificationParams) => params.actorUsername ?? 'Someone';
const watchlist = (params: NotificationParams) => params.watchlist ?? 'a watchlist';
const movie = (params: NotificationParams) => params.movie ?? 'a movie';

/**
 * Exhaustive by construction: adding a `DomainEventType` without a template is
 * a compile error rather than a blank notification at runtime.
 */
const TEMPLATES: Record<DomainEventType, (params: NotificationParams) => string> = {
  'friend.request.created': (p) => `You have received a new friend request from ${actor(p)}.`,
  'friend.request.accepted': (p) => `${actor(p)} has accepted your friend request.`,
  'friend.request.declined': (p) => `${actor(p)} has declined your friend request.`,
  'friend.request.cancelled': (p) => `${actor(p)} has cancelled their friend request.`,
  'friend.removed': (p) => `${actor(p)} has removed you as a friend.`,
  'watchlist.user.added': (p) => `You have been added to the watchlist "${watchlist(p)}".`,
  'watchlist.user.removed': (p) => `You have been removed from the watchlist "${watchlist(p)}".`,
  'watchlist.movie.added': (p) =>
    `${actor(p)} added "${movie(p)}" to the watchlist "${watchlist(p)}".`,
  'watchlist.movie.removed': (p) =>
    `${actor(p)} removed "${movie(p)}" from the watchlist "${watchlist(p)}".`,
  'watchlist.deleted': (p) => `${actor(p)} deleted the watchlist "${watchlist(p)}".`,
};

const TITLES: Record<string, string> = {
  friend: 'Friends',
  watchlist: 'Watchlists',
};

export function notificationText(type: DomainEventType, params: NotificationParams): string {
  return TEMPLATES[type](params);
}

/** Derived from the type's namespace, so a new `friend.*` type needs no entry. */
export function notificationTitle(type: DomainEventType): string {
  const [namespace] = type.split('.');
  return TITLES[namespace ?? ''] ?? 'Notifications';
}
