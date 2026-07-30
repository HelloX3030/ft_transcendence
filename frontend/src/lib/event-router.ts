import type { DomainEventType } from '@trailertinder/shared';

/**
 * The stores an event can invalidate. Passed in rather than imported so the
 * routing table can be exercised without booting Pinia.
 */
export interface InvalidationTargets {
  refetchFriends: () => void;
  invalidateWatchlists: () => void;
}

/**
 * What each event type invalidates.
 *
 * Refetching rather than patching state locally is what makes this safe:
 * invalidation is idempotent and order-independent, so a duplicated or
 * out-of-order event is harmless. The exhaustive `Record` means a new event type
 * without a route is a compile error, not a silently missing live update.
 */
export function invalidationMap(targets: InvalidationTargets): Record<DomainEventType, () => void> {
  const { refetchFriends, invalidateWatchlists } = targets;

  return {
    'friend.request.created': refetchFriends,
    'friend.request.accepted': refetchFriends,
    'friend.request.declined': refetchFriends,
    'friend.request.cancelled': refetchFriends,
    'friend.removed': refetchFriends,
    'watchlist.user.added': invalidateWatchlists,
    'watchlist.user.removed': invalidateWatchlists,
    'watchlist.movie.added': invalidateWatchlists,
    'watchlist.movie.removed': invalidateWatchlists,
    'watchlist.deleted': invalidateWatchlists,
  };
}
