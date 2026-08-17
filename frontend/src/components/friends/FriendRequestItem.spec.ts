// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { flushPromises } from '@vue/test-utils';
import type { Friend } from '@cinemates/shared';

const getById = vi.fn();
vi.mock('@/api/endpoints/user', () => ({ userApi: { getById: (id: number) => getById(id) } }));

const friendsDelete = vi.fn();
vi.mock('@/api/endpoints/friends', () => ({
  friendsApi: {
    getAll: vi.fn().mockResolvedValue([]),
    acceptRequest: vi.fn().mockResolvedValue(undefined),
    sendRequest: vi.fn().mockResolvedValue(undefined),
    delete: (id: number) => friendsDelete(id),
  },
}));

vi.mock('vue-sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import FriendRequestItem from './FriendRequestItem.vue';
import { useUserStore } from '@/stores/user';

const ME = 1;
const PEER = 7;

/** Mounts the row as the signed-in user `ME` sees it. */
async function mountRequest(initiatorId: number) {
  const user = useUserStore();
  user.state = { id: ME, username: 'me' } as never;

  const friend: Friend = {
    friendId: initiatorId === ME ? PEER : ME,
    initiatorId,
    status: 'pending',
    createdAt: '2026-01-01T00:00:00.000Z',
  };

  const wrapper = mount(FriendRequestItem, { props: friend });
  await flushPromises();
  return wrapper;
}

function labels(wrapper: Awaited<ReturnType<typeof mountRequest>>) {
  return wrapper.findAll('button').map((b) => b.attributes('aria-label'));
}

describe('FriendRequestItem', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    getById.mockResolvedValue({ id: PEER, username: 'peer', avatarFileId: null });
    friendsDelete.mockResolvedValue(undefined);
  });

  it('offers to cancel a request the user sent', async () => {
    const wrapper = await mountRequest(ME);

    expect(labels(wrapper)).toEqual(['Cancel request']);

    await wrapper.get('button').trigger('click');
    await flushPromises();

    // The peer id, not our own: the backend reads the id as "the other side of
    // this row" and derives the cancelled-vs-declined notification from it.
    expect(friendsDelete).toHaveBeenCalledWith(PEER);
  });

  it('offers accept and decline, and no cancel, on an incoming request', async () => {
    const wrapper = await mountRequest(PEER);

    expect(labels(wrapper)).toEqual(['Accept', 'Decline']);
  });
});
