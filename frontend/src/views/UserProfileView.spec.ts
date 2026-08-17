// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createMemoryHistory, createRouter, type Router } from 'vue-router';
import type { Friend } from '@cinemates/shared';
import { ApiError } from '@/api/api-error';

const getById = vi.fn();
vi.mock('@/api/endpoints/user', () => ({
  userApi: { getById: (id: number) => getById(id), getMe: vi.fn() },
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
vi.mock('vue-sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import UserProfileView from './UserProfileView.vue';
import { useFriendsStore } from '@/stores/friends';
import { useUserStore } from '@/stores/user';

const ME = 1;
const PEER = 7;

const PROFILE = { id: PEER, username: 'peer', avatarFileId: null };

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
    getById.mockResolvedValue(PROFILE);
    getAll.mockResolvedValue([]);
    sendRequest.mockResolvedValue(undefined);
  });

  describe('loading the profile', () => {
    it('renders the user it fetched through the API layer', async () => {
      const { wrapper } = await mountProfile(PEER);

      expect(getById).toHaveBeenCalledWith(PEER);
      expect(wrapper.text()).toContain('peer');
    });

    it('shows "not found" on a 404', async () => {
      getById.mockRejectedValue(new ApiError(404, 'User not found.'));
      const { wrapper } = await mountProfile(PEER);

      expect(wrapper.text()).toContain('User not found');
    });

    it('shows a retryable error on anything else', async () => {
      getById.mockRejectedValue(new ApiError(500, 'boom'));
      const { wrapper } = await mountProfile(PEER);

      expect(wrapper.text()).toContain('Could not load this profile.');
      expect(wrapper.text()).toContain('Try again');
    });

    it('treats an id that is not a number as "not found", without asking the API', async () => {
      const { wrapper } = await mountProfile('abc');

      expect(getById).not.toHaveBeenCalled();
      expect(wrapper.text()).toContain('User not found');
    });

    it('reloads when the id in the URL changes', async () => {
      const { wrapper, router } = await mountProfile(PEER);

      getById.mockResolvedValue({ id: 9, username: 'someone-else', avatarFileId: null });
      await router.push('/users/9');
      await flushPromises();

      expect(getById).toHaveBeenLastCalledWith(9);
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
      getById.mockResolvedValue({ id: ME, username: 'me', avatarFileId: null });
      const { wrapper } = await mountProfile(ME);

      expect(wrapper.findAll('button')).toHaveLength(0);
    });
  });
});
