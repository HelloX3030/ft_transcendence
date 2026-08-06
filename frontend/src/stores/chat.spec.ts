import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import type { ChatMessage } from '@cinemates/shared';

const chatApi = {
  conversations: vi.fn(),
  messages: vi.fn(),
  markRead: vi.fn(),
};

vi.mock('@/api/endpoints/chat', () => ({ chatApi }));
vi.mock('@/api/endpoints/friends', () => ({
  friendsApi: { getAll: vi.fn().mockResolvedValue([]) },
}));
vi.mock('@/api/endpoints/user', () => ({
  userApi: { getById: vi.fn().mockResolvedValue(null) },
}));
// The store logs handled failures; keep the expected ones out of the output.
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), debug: vi.fn(), warn: vi.fn() } }));

const { useChatStore } = await import('./chat');

const ME = 1;
const PEER = 2;

function message(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: 100,
    peerUserId: PEER,
    senderUserId: ME,
    body: 'hello',
    readAt: null,
    createdAt: '2026-07-30T10:00:00.000Z',
    ...overrides,
  };
}

describe('chat store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  describe('hydrate', () => {
    it('seeds one chat per conversation, in the order the server sent them', async () => {
      chatApi.conversations.mockResolvedValue([
        { peerUserId: 3, lastMessage: message({ id: 1, peerUserId: 3 }), unreadCount: 2 },
        { peerUserId: 2, lastMessage: null, unreadCount: 0 },
      ]);
      const store = useChatStore();

      await store.hydrate();

      expect(store.orderedChats.map((chat) => chat.friend.id)).toEqual([3, 2]);
      expect(store.getChat(3)?.unreadCount).toBe(2);
      expect(store.getChat(3)?.messages).toHaveLength(1);
      expect(store.getChat(2)?.messages).toHaveLength(0);
      expect(store.isHydrated).toBe(true);
    });

    it('survives a failed hydration without corrupting the cache', async () => {
      chatApi.conversations.mockRejectedValue(new Error('offline'));
      const store = useChatStore();

      await store.hydrate();

      expect(store.orderedChats).toEqual([]);
      expect(store.isHydrated).toBe(false);
    });
  });

  describe('clientMsgId dedup', () => {
    it('renders one message from an optimistic send plus its echo', () => {
      const store = useChatStore();
      const chat = store.ensureChat(PEER);

      store.addOptimistic(chat, 'c-1', 'hello', ME);
      store.ingestMessage(message({ clientMsgId: 'c-1' }));

      expect(chat.messages).toHaveLength(1);
      expect(chat.messages[0]).toMatchObject({ id: 100, body: 'hello', status: undefined });
    });

    it('reconciles only once when the ack and the echo both arrive', () => {
      const store = useChatStore();
      const chat = store.ensureChat(PEER);

      store.addOptimistic(chat, 'c-1', 'hello', ME);
      store.ingestMessage(message({ clientMsgId: 'c-1' }));
      store.ingestMessage(message({ clientMsgId: 'c-1' }));

      expect(chat.messages).toHaveLength(1);
    });

    it('ignores a duplicate delivery of the same row id', () => {
      const store = useChatStore();
      const chat = store.ensureChat(PEER);

      store.ingestMessage(message({ id: 7, senderUserId: PEER }));
      store.ingestMessage(message({ id: 7, senderUserId: PEER }));

      expect(chat.messages).toHaveLength(1);
    });

    it('leaves an unacknowledged message marked failed', () => {
      const store = useChatStore();
      const chat = store.ensureChat(PEER);

      store.addOptimistic(chat, 'c-1', 'hello', ME);
      store.markFailed(chat, 'c-1');

      expect(chat.messages[0]?.status).toBe('failed');
    });
  });

  describe('unread counting', () => {
    it('counts an incoming message when its chat is not the open one', () => {
      const store = useChatStore();
      const chat = store.ensureChat(PEER);

      store.ingestMessage(message({ id: 7, senderUserId: PEER }));

      expect(chat.unreadCount).toBe(1);
    });

    it('never counts the echo of a message we sent ourselves', () => {
      const store = useChatStore();
      const chat = store.ensureChat(PEER);

      store.ingestMessage(message({ id: 7, senderUserId: ME }));

      expect(chat.unreadCount).toBe(0);
    });
  });

  describe('loadOlder', () => {
    it('prepends the older page and keeps the transcript ascending', async () => {
      chatApi.messages
        .mockResolvedValueOnce({
          messages: [message({ id: 10 }), message({ id: 11 })],
          nextCursor: 'c1',
        })
        .mockResolvedValueOnce({
          messages: [message({ id: 8 }), message({ id: 9 })],
          nextCursor: null,
        });
      const store = useChatStore();
      const chat = store.ensureChat(PEER);

      await store.loadFirstPage(chat);
      await store.loadOlder(chat);

      expect(chat.messages.map(({ id }) => id)).toEqual([8, 9, 10, 11]);
      expect(chat.hasMore).toBe(false);
    });

    it('drops a row the older page repeats rather than rendering it twice', async () => {
      chatApi.messages
        .mockResolvedValueOnce({ messages: [message({ id: 10 })], nextCursor: 'c1' })
        .mockResolvedValueOnce({
          messages: [message({ id: 9 }), message({ id: 10 })],
          nextCursor: null,
        });
      const store = useChatStore();
      const chat = store.ensureChat(PEER);

      await store.loadFirstPage(chat);
      await store.loadOlder(chat);

      expect(chat.messages.map(({ id }) => id)).toEqual([9, 10]);
    });

    it('does nothing when there is no older page', async () => {
      chatApi.messages.mockResolvedValue({ messages: [], nextCursor: null });
      const store = useChatStore();
      const chat = store.ensureChat(PEER);
      await store.loadFirstPage(chat);

      await store.loadOlder(chat);

      expect(chatApi.messages).toHaveBeenCalledTimes(1);
    });
  });

  describe('$reset', () => {
    it('drops the cache only — the server keeps the transcripts', async () => {
      chatApi.conversations.mockResolvedValue([
        { peerUserId: PEER, lastMessage: message(), unreadCount: 1 },
      ]);
      const store = useChatStore();
      await store.hydrate();

      store.$reset();

      expect(store.orderedChats).toEqual([]);
      expect(store.activeChat).toBeUndefined();
      expect(store.isHydrated).toBe(false);
    });
  });
});
