import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/api/api-error';

const setReaction = vi.fn();
const error = vi.fn();

vi.mock('@/api', () => ({
  moviesApi: { setReaction: (...args: unknown[]) => setReaction(...args) },
}));
vi.mock('vue-sonner', () => ({ toast: { error: (...args: unknown[]) => error(...args) } }));

const { useTrailerReaction } = await import('./useTrailerReaction');

/** A promise plus the handles to settle it, so the pending window is testable. */
function deferred() {
  let resolve!: () => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = () => res();
    reject = rej;
  });
  // Attached up front so a later rejection is never an unhandled one.
  promise.catch(() => {});
  return { promise, resolve, reject };
}

describe('useTrailerReaction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setReaction.mockResolvedValue(undefined);
  });

  // The swipe interaction cannot wait on a round-trip; a spinner on a like
  // button is worse than a rare revert.
  it('fills and locks before the request resolves', async () => {
    const { promise, resolve } = deferred();
    setReaction.mockReturnValue(promise);

    const { isLiked, isLocked, react } = useTrailerReaction(640146);
    const pending = react('like');

    expect(isLiked.value).toBe(true);
    expect(isLocked.value).toBe(true);

    resolve();
    await pending;
  });

  it('keeps the reaction and stays quiet on success', async () => {
    const { isLiked, isLocked, react } = useTrailerReaction(640146);

    await react('like');

    expect(setReaction).toHaveBeenCalledWith(640146, 'like');
    expect(isLiked.value).toBe(true);
    expect(isLocked.value).toBe(true);
    expect(error).not.toHaveBeenCalled();
  });

  // A filled heart with no row behind it is the silent lie this guards against.
  it('reverts and reports a failure', async () => {
    setReaction.mockRejectedValue(new Error('Network down'));

    const { reaction, isLiked, isLocked, react } = useTrailerReaction(640146);
    await react('like');

    expect(reaction.value).toBeNull();
    expect(isLiked.value).toBe(false);
    expect(isLocked.value).toBe(false);
    expect(error).toHaveBeenCalledWith('Network down');
  });

  // 409 means the server already holds the state we asked for — desired, not an error.
  it('absorbs a 409 without unlocking or toasting', async () => {
    setReaction.mockRejectedValue(new ApiError(409, 'You have already reacted to this movie.'));

    const { isLiked, isLocked, react } = useTrailerReaction(640146);
    await react('like');

    expect(isLiked.value).toBe(true);
    expect(isLocked.value).toBe(true);
    expect(error).not.toHaveBeenCalled();
  });

  it('refuses to flip a reaction once it is set', async () => {
    const { isLiked, isDisliked, react } = useTrailerReaction(640146);

    await react('like');
    await react('dislike');

    expect(setReaction).toHaveBeenCalledTimes(1);
    expect(isLiked.value).toBe(true);
    expect(isDisliked.value).toBe(false);
  });

  it('sends one request for a double-click', async () => {
    const { react } = useTrailerReaction(640146);

    await Promise.all([react('like'), react('like')]);

    expect(setReaction).toHaveBeenCalledTimes(1);
  });

  it('reads a getter id at request time', async () => {
    let id = 1;
    const { react } = useTrailerReaction(() => id);
    id = 2;

    await react('like');

    expect(setReaction).toHaveBeenCalledWith(2, 'like');
  });
});
