import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

const getReaction = vi.fn();

vi.mock('@/api', () => ({ moviesApi: { getReaction: (id: number) => getReaction(id) } }));
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), debug: vi.fn(), warn: vi.fn() } }));

const { useReactionsStore } = await import('./reactions');

describe('reactions store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    getReaction.mockResolvedValue({ reaction: 'like' });
  });

  it('fetches a reaction once, however many players ask', async () => {
    const store = useReactionsStore();

    await Promise.all([store.ensureLoaded(1), store.ensureLoaded(1)]);
    await store.ensureLoaded(1);

    expect(getReaction).toHaveBeenCalledTimes(1);
    expect(store.reactions[1]).toBe('like');
  });

  it('does not ask about films the feed marked unreacted', async () => {
    const store = useReactionsStore();

    store.markUnreacted([1, 2]);
    await store.ensureLoaded(1);

    expect(getReaction).not.toHaveBeenCalled();
    expect(store.reactions).toEqual({ 1: null, 2: null });
  });

  it('keeps a reaction given while the fetch was in flight', async () => {
    getReaction.mockResolvedValue({ reaction: null });
    const store = useReactionsStore();

    const loading = store.ensureLoaded(1);
    store.reactions[1] = 'dislike';
    await loading;

    expect(store.reactions[1]).toBe('dislike');
  });

  it('leaves a failed fetch unknown, so a later mount retries', async () => {
    getReaction.mockRejectedValueOnce(new Error('Network down'));
    const store = useReactionsStore();

    await store.ensureLoaded(1);
    expect(1 in store.reactions).toBe(false);

    await store.ensureLoaded(1);
    expect(store.reactions[1]).toBe('like');
  });

  it('drops an answer that arrives after a reset, so the next user starts clean', async () => {
    const store = useReactionsStore();

    const loading = store.ensureLoaded(1);
    store.$reset();
    await loading;

    expect(store.reactions).toEqual({});
  });
});
