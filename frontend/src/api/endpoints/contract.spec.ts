import { beforeEach, describe, expect, it, vi } from 'vitest';

const backendClient = vi.fn();
vi.mock('../client', () => ({ backendClient: (...args: unknown[]) => backendClient(...args) }));
vi.mock('../upload', () => ({ uploadWithProgress: vi.fn() }));

const { authApi } = await import('./auth');
const { chatApi } = await import('./chat');
const { friendsApi } = await import('./friends');
const { userApi } = await import('./user');
const { watchlistApi } = await import('./watchlist');

/**
 * These helpers are where paths live, now that nothing in the app calls `fetch`
 * directly. A typo in one is invisible to the compiler, since `backendClient<T>`
 * casts the response, so the path and the method are asserted here. The bodies
 * and response types are not: the compiler checks those against the contract.
 */
function lastCall() {
  const [path, options] = backendClient.mock.calls.at(-1) as [string, RequestInit | undefined];
  return { path, method: options?.method ?? 'GET', headers: options?.headers };
}

describe('endpoint contract', () => {
  beforeEach(() => {
    backendClient.mockReset();
    backendClient.mockResolvedValue(undefined);
  });

  describe('auth', () => {
    it('asks /auth/me for the session', () => {
      authApi.session();
      expect(lastCall()).toMatchObject({ path: '/auth/me', method: 'GET' });
    });

    it('posts a login', () => {
      authApi.login({ email: 'a@b.de', password: 'pw' });
      expect(lastCall()).toMatchObject({
        path: '/auth/login',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
    });
  });

  describe('users', () => {
    it('reads another user by id: under /users, which is where the API serves them', () => {
      userApi.getById(7);
      expect(lastCall()).toMatchObject({ path: '/users/7', method: 'GET' });
    });

    it('reads the profile page from its own path, so the lean read stays lean', () => {
      userApi.getProfileById(7);
      expect(lastCall()).toMatchObject({ path: '/users/7/profile', method: 'GET' });
    });

    it('reads the signed-in user', () => {
      userApi.getMe();
      expect(lastCall()).toMatchObject({ path: '/users/me', method: 'GET' });
    });

    it('posts the onboarding picks', () => {
      userApi.onboarding([1, 2, 3]);
      expect(lastCall()).toMatchObject({
        path: '/users/me/onboarding',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
    });
  });

  describe('friends', () => {
    it('sends, accepts and deletes against the same id', () => {
      friendsApi.sendRequest(7);
      expect(lastCall()).toMatchObject({ path: '/friends/7', method: 'POST' });

      friendsApi.delete(7);
      expect(lastCall()).toMatchObject({ path: '/friends/7', method: 'DELETE' });
    });
  });

  describe('chat', () => {
    it('marks a conversation read', () => {
      chatApi.markRead(7);
      expect(lastCall()).toMatchObject({ path: '/chat/7/read', method: 'POST' });
    });

    it('omits the query string entirely when no page options are given', () => {
      chatApi.messages(7);
      expect(lastCall().path).toBe('/chat/7/messages');

      chatApi.messages(7, { limit: 30 });
      expect(lastCall().path).toBe('/chat/7/messages?limit=30');
    });
  });

  describe('watchlists', () => {
    it('reads the members of a list', () => {
      watchlistApi.getUsers(3);
      expect(lastCall()).toMatchObject({ path: '/watchlists/3/users', method: 'GET' });
    });

    it('reads the movies on a list', () => {
      watchlistApi.getMoviesById(3);
      expect(lastCall()).toMatchObject({ path: '/watchlists/3/movies', method: 'GET' });
    });
  });
});
