import { describe, expect, it } from 'vitest';
import { DOMAIN_EVENT_TYPES } from '@trailertinder/shared';
import { notificationText, notificationTitle } from './notification-text';

const FULL_PARAMS = {
  actorUsername: 'alice',
  watchlist: 'Horror Night',
  movie: 'Alien',
};

describe('notificationText', () => {
  it.each(DOMAIN_EVENT_TYPES)('renders %s', (type) => {
    const text = notificationText(type, FULL_PARAMS);

    expect(text.length).toBeGreaterThan(0);
    expect(text).not.toContain('undefined');
  });

  it.each(DOMAIN_EVENT_TYPES)('renders %s with no params at all', (type) => {
    // A row whose params were lost (or an event type that gained a placeholder
    // after the row was written) must still produce a readable sentence.
    const text = notificationText(type, {});

    expect(text).not.toContain('undefined');
    expect(text).not.toContain('""');
  });

  it('interpolates the snapshotted values rather than looking anything up', () => {
    expect(notificationText('watchlist.movie.added', FULL_PARAMS)).toBe(
      'alice added "Alien" to the watchlist "Horror Night".',
    );
  });

  it('uses the actor placeholder when the actor is unknown', () => {
    expect(notificationText('friend.removed', {})).toBe('Someone has removed you as a friend.');
  });
});

describe('notificationTitle', () => {
  it('derives the title from the type namespace', () => {
    expect(notificationTitle('friend.request.created')).toBe('Friends');
    expect(notificationTitle('watchlist.deleted')).toBe('Watchlists');
  });

  it.each(DOMAIN_EVENT_TYPES)('has a title for %s', (type) => {
    expect(notificationTitle(type)).not.toBe('Notifications');
  });
});
