// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createMemoryHistory, createRouter, type Router } from 'vue-router';
import type { Friend } from '@cinemates/shared';
import { ApiError } from '@/api/api-error';
import { formatDate } from '@/lib/format';

const getProfileById = vi.fn();
vi.mock('@/api/endpoints/user', () => ({
  userApi: {
    // The lean read the friends store resolves each row with — the chat store
    // watches those details, so it has to answer with a user.
    getById: (id: number) => Promise.resolve({ id, username: `user-${id}`, avatarFileId: null }),
    getProfileById: (id: number) => getProfileById(id),
    getMe: vi.fn(),
  },
}));

// The preference cards resolve ids through these two caches; both are backed by
// the API, so they are stubbed the same way the profile read is.
const genreName = vi.fn((id: number) => `genre-${id}`);
const personName = vi.fn((id: number) => `person-${id}`);
vi.mock('@/stores/genres', () => ({
  useGenresStore: () => ({ genreName, ensureLoaded: vi.fn().mockResolvedValue(undefined) }),
}));
vi.mock('@/stores/people', () => ({
  usePeopleStore: () => ({ personName, ensureLoaded: vi.fn().mockResolvedValue(undefined) }),
}));

const sendRequest = vi.fn();
const getAll = vi.fn();
vi.mock('@/api/endpoints/friends', () => ({
  friendsApi: {
    getAll: () => getAll(),
    sendRequest: (id: number) => sendRequest(id),
    delete: vi.fn(),
    acceptRequest: vi.fn(),
  },
}));
vi.mock('@/api/endpoints/chat', () => ({
  chatApi: {
    conversations: vi.fn().mockResolvedValue([]),
    // Selecting a chat loads its first page; an empty one keeps that path quiet.
    messages: vi.fn().mockResolvedValue({ messages: [], nextCursor: null }),
  },
}));
// Presence rides a socket the view never opens itself; only the answer matters.
const onlineIds = new Set<number>();
vi.mock('@/stores/notify', () => ({
  useNotifyStore: () => ({ isUserOnline: (id: number) => onlineIds.has(id) }),
}));

vi.mock('vue-sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import UserProfileView from './UserProfileView.vue';
import { useFriendsStore } from '@/stores/friends';
import { useUserStore } from '@/stores/user';

const ME = 1;
const PEER = 7;

const PROFILE = {
  id: PEER,
  username: 'peer',
  avatarFileId: null,
  genreIds: [28],
  actorIds: [500],
  directorIds: [138],
};

/** PresenceDot is the only `role="img"` this page renders. */
const PRESENCE_DOT = '[role="img"]';

function makeRouter(): Router {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/users/:id', component: UserProfileView },
      { path: '/friends', component: { template: '<div />' } },
      { path: '/chat', component: { template: '<div />' } },
    ],
  });
}

/** Mounts the view at `/users/:id` with the friends list the API would return. */
async function mountProfile(id: number | string, friends: Friend[] = []) {
  const user = useUserStore();
  user.state = { id: ME, username: 'me' } as never;

  // Seeded through the API rather than by assigning `state`: the store fetches
  // on creation, and that fetch would overwrite anything written directly.
  getAll.mockResolvedValue(friends);
  useFriendsStore();

  const router = makeRouter();
  await router.push(`/users/${id}`);
  await router.isReady();

  const wrapper = mount(UserProfileView, { global: { plugins: [router] } });
  await flushPromises();
  return { wrapper, router };
}

function friendRow(status: Friend['status'], initiatorId: number): Friend {
  return { friendId: PEER, status, initiatorId, createdAt: '2026-01-01T00:00:00.000Z' };
}

describe('UserProfileView', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    onlineIds.clear();
    getProfileById.mockResolvedValue(PROFILE);
    getAll.mockResolvedValue([]);
    sendRequest.mockResolvedValue(undefined);
  });

  describe('loading the profile', () => {
    it('renders the user it fetched through the API layer', async () => {
      const { wrapper } = await mountProfile(PEER);

      expect(getProfileById).toHaveBeenCalledWith(PEER);
      expect(wrapper.text()).toContain('peer');
    });

    it('shows "not found" on a 404', async () => {
      getProfileById.mockRejectedValue(new ApiError(404, 'User not found.'));
      const { wrapper } = await mountProfile(PEER);

      expect(wrapper.text()).toContain('User not found');
    });

    it('shows a retryable error on anything else', async () => {
      getProfileById.mockRejectedValue(new ApiError(500, 'boom'));
      const { wrapper } = await mountProfile(PEER);

      expect(wrapper.text()).toContain('Could not load this profile.');
      expect(wrapper.text()).toContain('Try again');
    });

    it('treats an id that is not a number as "not found", without asking the API', async () => {
      const { wrapper } = await mountProfile('abc');

      expect(getProfileById).not.toHaveBeenCalled();
      expect(wrapper.text()).toContain('User not found');
    });

    it('reloads when the id in the URL changes', async () => {
      const { wrapper, router } = await mountProfile(PEER);

      getProfileById.mockResolvedValue({ id: 9, username: 'someone-else', avatarFileId: null });
      await router.push('/users/9');
      await flushPromises();

      expect(getProfileById).toHaveBeenLastCalledWith(9);
      expect(wrapper.text()).toContain('someone-else');
    });
  });

  describe('the action buttons', () => {
    it('offers Message to a friend', async () => {
      const { wrapper, router } = await mountProfile(PEER, [friendRow('accepted', ME)]);

      expect(wrapper.text()).toContain('Message');

      await wrapper.get('button').trigger('click');
      await flushPromises();
      expect(router.currentRoute.value.path).toBe('/chat');
    });

    it('offers Add Friend when there is no row, and sends the request', async () => {
      const { wrapper } = await mountProfile(PEER);

      expect(wrapper.text()).toContain('Add Friend');

      await wrapper.get('button').trigger('click');
      await flushPromises();
      expect(sendRequest).toHaveBeenCalledWith(PEER);
    });

    it('says a request is already sent, and does not repeat it', async () => {
      const { wrapper } = await mountProfile(PEER, [friendRow('pending', ME)]);

      expect(wrapper.text()).toContain('Request sent');
      expect(wrapper.get('button').attributes('disabled')).toBeDefined();
    });

    it('points at the friends page for a request the other side sent', async () => {
      const { wrapper } = await mountProfile(PEER, [friendRow('pending', PEER)]);

      expect(wrapper.text()).toContain('Respond on the Friends page');
      expect(wrapper.get('a').attributes('href')).toBe('/friends');
    });

    it('offers nothing on your own profile', async () => {
      getProfileById.mockResolvedValue({ ...PROFILE, id: ME, username: 'me' });
      const { wrapper } = await mountProfile(ME);

      expect(wrapper.findAll('button')).toHaveLength(0);
    });
  });

  describe('the preference cards', () => {
    it('renders the three sections with the resolved names', async () => {
      const { wrapper } = await mountProfile(PEER);

      expect(wrapper.text()).toContain('Favorite Genres');
      expect(wrapper.text()).toContain('Favorite Directors');
      expect(wrapper.text()).toContain('Favorite Actors');

      expect(wrapper.text()).toContain('genre-28');
      expect(wrapper.text()).toContain('person-138');
      expect(wrapper.text()).toContain('person-500');
    });

    it('keeps the cards, with their empty states, for a user who never onboarded', async () => {
      getProfileById.mockResolvedValue({
        ...PROFILE,
        genreIds: [],
        actorIds: [],
        directorIds: [],
      });
      const { wrapper } = await mountProfile(PEER);

      expect(wrapper.text()).toContain('No favorite genres yet');
      expect(wrapper.text()).toContain('No favorite directors yet');
      expect(wrapper.text()).toContain('No favorite actors yet');
    });
  });

  describe('presence and "friends since"', () => {
    it('shows both on a friend', async () => {
      onlineIds.add(PEER);
      const { wrapper } = await mountProfile(PEER, [friendRow('accepted', ME)]);

      const dot = wrapper.get(PRESENCE_DOT);
      expect(dot.attributes('aria-label')).toBe('Online');
      // Through the helper, not `toLocaleDateString()`: the bare call reads the
      // machine's locale, so the assertion would pass here and fail elsewhere.
      expect(wrapper.text()).toContain(`Friends since ${formatDate('2026-01-01T00:00:00.000Z')}`);
    });

    it('shows neither on a stranger — an absent id is not a known-offline one', async () => {
      const { wrapper } = await mountProfile(PEER);

      expect(wrapper.find(PRESENCE_DOT).exists()).toBe(false);
      expect(wrapper.text()).not.toContain('Friends since');
    });
  });
});
