import { notification_type } from '@prisma/client';
import { DomainEventType } from '@cinemates/shared';

/**
 * Database enum → wire discriminator.
 *
 * Two vocabularies exist on purpose: Postgres enum members cannot contain dots,
 * and the client routes on a dotted namespace it can prefix-match
 * (`friend.*` → Friends). Declaring the map as an exhaustive `Record` means a
 * new enum member without a mapping is a compile error, not a blank
 * notification at runtime.
 */
export const EVENT_TYPE: Record<notification_type, DomainEventType> = {
  friend_request_created: 'friend.request.created',
  friend_request_accepted: 'friend.request.accepted',
  friend_request_declined: 'friend.request.declined',
  friend_request_cancelled: 'friend.request.cancelled',
  friend_removed: 'friend.removed',
  watchlist_user_added: 'watchlist.user.added',
  watchlist_user_removed: 'watchlist.user.removed',
  watchlist_movie_added: 'watchlist.movie.added',
  watchlist_movie_removed: 'watchlist.movie.removed',
  watchlist_deleted: 'watchlist.deleted',
};
