import { describe, expect, it, vi } from 'vitest';
import { DOMAIN_EVENT_TYPES } from '@trailertinder/shared';
import { invalidationMap } from './event-router';

function stubTargets() {
  return { refetchFriends: vi.fn(), invalidateWatchlists: vi.fn() };
}

describe('invalidationMap', () => {
  it('routes every domain event type', () => {
    // Fails the moment an event type is added without a route, so a new feature
    // cannot ship with silently dead live updates.
    const routes = invalidationMap(stubTargets());

    expect(Object.keys(routes).sort()).toEqual([...DOMAIN_EVENT_TYPES].sort());
  });

  it('invalidates the friend list for every friend event', () => {
    const targets = stubTargets();
    const routes = invalidationMap(targets);

    for (const type of DOMAIN_EVENT_TYPES.filter((t) => t.startsWith('friend.'))) {
      routes[type]();
    }

    expect(targets.refetchFriends).toHaveBeenCalledTimes(5);
    expect(targets.invalidateWatchlists).not.toHaveBeenCalled();
  });

  it('invalidates watchlists for every watchlist event', () => {
    const targets = stubTargets();
    const routes = invalidationMap(targets);

    for (const type of DOMAIN_EVENT_TYPES.filter((t) => t.startsWith('watchlist.'))) {
      routes[type]();
    }

    expect(targets.invalidateWatchlists).toHaveBeenCalledTimes(5);
    expect(targets.refetchFriends).not.toHaveBeenCalled();
  });

  it('is idempotent — a duplicate event just refetches again', () => {
    const targets = stubTargets();
    const routes = invalidationMap(targets);

    routes['friend.request.created']();
    routes['friend.request.created']();

    expect(targets.refetchFriends).toHaveBeenCalledTimes(2);
  });
});
