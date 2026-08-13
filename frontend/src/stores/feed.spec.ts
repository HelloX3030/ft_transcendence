import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import type { FeedMovie } from '@cinemates/shared';

const getFeed = vi.fn();

vi.mock('@/api', () => ({ moviesApi: { getFeed: () => getFeed() as Promise<FeedMovie[]> } }));
// The store logs handled failures; keep the expected ones out of the output.
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), debug: vi.fn(), warn: vi.fn() } }));

const { useFeedStore } = await import('./feed');

function card(tmdbId: number): FeedMovie {
  return {
    tmdbId,
    title: `Movie ${tmdbId}`,
    overview: 'overview',
    posterPath: '/poster.jpg',
    backdropPath: '/backdrop.jpg',
    releaseDate: '2024-01-01',
    genreIds: [28],
    trailerKey: `key-${tmdbId}`,
    voteAverage: 7.5,
  };
}

describe('feed store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('loads the first page', async () => {
    getFeed.mockResolvedValue([card(1), card(2)]);
    const feed = useFeedStore();

    await feed.load();

    expect(feed.cards.map((c) => c.tmdbId)).toEqual([1, 2]);
    expect(feed.status).toBe('ready');
  });

  it('reports a failed first load without cards', async () => {
    getFeed.mockRejectedValue(new Error('offline'));
    const feed = useFeedStore();

    await feed.load();

    expect(feed.cards).toEqual([]);
    expect(feed.status).toBe('error');
  });

  // The endpoint has no cursor: it returns the same films minus anything rated
  // since, so the overlap has to be filtered out here or cards would duplicate.
  it('appends only films it has not shown before', async () => {
    getFeed.mockResolvedValueOnce([card(1), card(2)]);
    const feed = useFeedStore();
    await feed.load();

    getFeed.mockResolvedValueOnce([card(2), card(3)]);
    await feed.loadMore();

    expect(feed.cards.map((c) => c.tmdbId)).toEqual([1, 2, 3]);
    expect(feed.exhausted).toBe(false);
  });

  it('marks the feed exhausted when nothing new comes back', async () => {
    getFeed.mockResolvedValueOnce([card(1), card(2)]);
    const feed = useFeedStore();
    await feed.load();

    getFeed.mockResolvedValueOnce([card(1), card(2)]);
    await feed.loadMore();

    expect(feed.cards).toHaveLength(2);
    expect(feed.exhausted).toBe(true);
  });

  // Conflating the two would turn a network blip into "you have seen everything",
  // which is terminal and offers no retry.
  it('does not mark the feed exhausted when the refetch fails', async () => {
    getFeed.mockResolvedValueOnce([card(1)]);
    const feed = useFeedStore();
    await feed.load();

    getFeed.mockRejectedValueOnce(new Error('offline'));
    await feed.loadMore();

    expect(feed.status).toBe('error');
    expect(feed.exhausted).toBe(false);
  });

  it('clears the shown set on reset, so the next user sees the same films', async () => {
    getFeed.mockResolvedValue([card(1), card(2)]);
    const feed = useFeedStore();
    await feed.load();

    feed.$reset();
    expect(feed.cards).toEqual([]);
    expect(feed.status).toBe('idle');
    expect(feed.exhausted).toBe(false);

    await feed.load();
    expect(feed.cards.map((c) => c.tmdbId)).toEqual([1, 2]);
  });

  // A logout mid-request must not land the previous session's cards in the new one.
  it('discards a response that arrives after a reset', async () => {
    let resolveLoad!: (cards: FeedMovie[]) => void;
    getFeed.mockReturnValue(
      new Promise<FeedMovie[]>((resolve) => {
        resolveLoad = resolve;
      }),
    );
    const feed = useFeedStore();

    const pending = feed.load();
    feed.$reset();
    resolveLoad([card(1)]);
    await pending;

    expect(feed.cards).toEqual([]);
    expect(feed.status).toBe('idle');
  });
});
