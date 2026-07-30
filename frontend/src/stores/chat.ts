import { defineStore } from 'pinia';
import { computed, ref, watch } from 'vue';
import type { ChatMessage, GetUserResponse } from '@trailertinder/shared';
import { chatApi } from '@/api/endpoints/chat';
import { logger } from '@/lib/logger';
import { useFriendsStore } from './friends';

const PAGE_SIZE = 30;

/**
 * A message in a transcript. `pending` is an optimistic render that has not been
 * acknowledged yet; `failed` is one the server refused.
 */
export interface ChatMessageEntry extends ChatMessage {
  status?: 'pending' | 'failed';
}

export interface Chat {
  friend: GetUserResponse;
  /** Ascending, oldest first — the order the UI renders and the API serves. */
  messages: ChatMessageEntry[];
  oldestCursor: string | null;
  hasMore: boolean;
  isLoadingOlder: boolean;
  /** Whether the first page has been fetched, so opening twice does not refetch. */
  isLoaded: boolean;
  unreadCount: number;
}

/**
 * Client-side view of server-owned transcripts.
 *
 * Nothing here is authoritative: `reset()` drops the cache and the next load
 * restores it from the server. The one piece of local truth is an optimistic
 * message, and it lives only until its ack or echo arrives.
 */
export const useChatStore = defineStore('chat', () => {
  const chats = ref(new Map<number, Chat>());
  /** Peer ids, most recently active first. Seeded by the server, then maintained. */
  const order = ref<number[]>([]);
  const activeChat = ref<Chat>();
  const isHydrated = ref(false);

  const friendsStore = useFriendsStore();

  const orderedChats = computed(() =>
    order.value
      .map((peerId) => chats.value.get(peerId))
      .filter((chat): chat is Chat => chat !== undefined),
  );

  // A transcript can be opened before the friend list resolves, so placeholders
  // are backfilled as soon as the real details turn up.
  watch(
    () => friendsStore.friendsDetails,
    (details) => {
      for (const friend of details) {
        const chat = chats.value.get(friend.id);
        if (chat) chat.friend = friend;
      }
    },
    { deep: true },
  );

  /** Seeds the list from the server: one entry per friend, ordered by recency. */
  async function hydrate() {
    try {
      const conversations = await chatApi.conversations();
      for (const conversation of conversations) {
        const chat = ensureChat(conversation.peerUserId);
        chat.unreadCount = conversation.unreadCount;
        // Enough for the list preview; the full page is fetched on open.
        if (conversation.lastMessage && chat.messages.length === 0) {
          chat.messages = [conversation.lastMessage];
        }
      }
      order.value = conversations.map(({ peerUserId }) => peerUserId);
      isHydrated.value = true;
    } catch (error) {
      logger.error('[chat] failed to hydrate conversations', error);
    }
  }

  function selectChat(chat: Chat) {
    activeChat.value = chat;
    void loadFirstPage(chat);
  }

  function closeChat() {
    activeChat.value = undefined;
  }

  function getChat(friendId: number) {
    return chats.value.get(friendId);
  }

  /**
   * Returns the transcript for `friendId`, opening one if it does not exist yet.
   * Unlike {@link createChat} this leaves the current selection alone, so an
   * incoming message never yanks the user out of the chat they are reading.
   */
  function ensureChat(friendId: number, details?: GetUserResponse) {
    const existing = chats.value.get(friendId);
    if (existing) {
      if (details) existing.friend = details;
      return existing;
    }

    const known = details ?? friendsStore.friendsDetails.find((friend) => friend.id === friendId);
    const chat: Chat = {
      friend: known ?? { id: friendId, username: `User ${friendId}`, image: null },
      messages: [],
      oldestCursor: null,
      hasMore: false,
      isLoadingOlder: false,
      isLoaded: false,
      unreadCount: 0,
    };
    chats.value.set(friendId, chat);
    if (!order.value.includes(friendId)) order.value.push(friendId);
    return chat;
  }

  function createChat(friend: GetUserResponse) {
    const chat = ensureChat(friend.id, friend);
    selectChat(chat);
    return chat;
  }

  /** Newest page, fetched once per chat. */
  async function loadFirstPage(chat: Chat) {
    if (chat.isLoaded) return;
    chat.isLoaded = true;
    try {
      const page = await chatApi.messages(chat.friend.id, { limit: PAGE_SIZE });
      chat.messages = page.messages;
      chat.oldestCursor = page.nextCursor;
      chat.hasMore = page.nextCursor !== null;
    } catch (error) {
      chat.isLoaded = false;
      logger.error('[chat] failed to load messages', error);
    }
  }

  /** Prepends the next older page. The caller restores the scroll anchor. */
  async function loadOlder(chat: Chat) {
    if (!chat.hasMore || chat.isLoadingOlder || chat.oldestCursor === null) return;

    chat.isLoadingOlder = true;
    try {
      const page = await chatApi.messages(chat.friend.id, {
        before: chat.oldestCursor,
        limit: PAGE_SIZE,
      });
      const known = new Set(chat.messages.map(({ id }) => id));
      chat.messages.unshift(...page.messages.filter(({ id }) => !known.has(id)));
      chat.oldestCursor = page.nextCursor;
      chat.hasMore = page.nextCursor !== null;
    } catch (error) {
      logger.error('[chat] failed to load older messages', error);
    } finally {
      chat.isLoadingOlder = false;
    }
  }

  /**
   * Renders a message before the server has confirmed it. Reconciled by
   * {@link ingestMessage} on whichever arrives first, the ack or the echo.
   */
  function addOptimistic(chat: Chat, clientMsgId: string, body: string, senderId: number) {
    chat.messages.push({
      // Negative so it can never collide with a real row id.
      id: -Date.now(),
      peerUserId: chat.friend.id,
      senderUserId: senderId,
      body,
      readAt: null,
      createdAt: new Date().toISOString(),
      clientMsgId,
      status: 'pending',
    });
    promote(chat.friend.id);
  }

  function markFailed(chat: Chat, clientMsgId: string) {
    const pending = chat.messages.find((message) => message.clientMsgId === clientMsgId);
    if (pending) pending.status = 'failed';
  }

  /**
   * Folds a server-confirmed message into its transcript.
   *
   * The sender's own tabs receive the broadcast too, so a message is matched on
   * `clientMsgId` first — that is what stops the optimistic copy and the echo
   * from rendering twice — and on `id` second, for delivery to the peer.
   */
  function ingestMessage(message: ChatMessage) {
    const chat = ensureChat(message.peerUserId);

    const optimistic =
      message.clientMsgId === undefined
        ? undefined
        : chat.messages.find((entry) => entry.clientMsgId === message.clientMsgId);
    if (optimistic) {
      Object.assign(optimistic, message, { status: undefined });
      promote(message.peerUserId);
      return chat;
    }

    if (chat.messages.some((entry) => entry.id === message.id)) return chat;

    chat.messages.push(message);
    // `peerUserId` is the other party from this reader's side, so a message
    // whose sender *is* the peer came in; anything else is our own echo from
    // another tab and was never unread.
    const fromPeer = message.senderUserId === message.peerUserId;
    if (fromPeer && activeChat.value?.friend.id !== message.peerUserId) {
      chat.unreadCount++;
    }
    promote(message.peerUserId);
    return chat;
  }

  /** Applies a read receipt from the peer to our own outgoing messages. */
  function applyReadReceipt(peerUserId: number, readAt: string) {
    const chat = chats.value.get(peerUserId);
    if (!chat) return;
    for (const message of chat.messages) {
      if (message.senderUserId !== peerUserId) message.readAt ??= readAt;
    }
  }

  /**
   * Marks the peer's messages read. Called when the window is scrolled to the
   * bottom rather than merely open, so scrollback does not clear the badge.
   */
  async function markRead(chat: Chat) {
    if (chat.unreadCount === 0) return;

    const previous = chat.unreadCount;
    chat.unreadCount = 0;
    try {
      const { readAt } = await chatApi.markRead(chat.friend.id);
      for (const message of chat.messages) {
        if (message.senderUserId === chat.friend.id) message.readAt ??= readAt;
      }
    } catch (error) {
      chat.unreadCount = previous;
      logger.error('[chat] failed to mark conversation read', error);
    }
  }

  function deleteChat(friendId: number) {
    chats.value.delete(friendId);
    order.value = order.value.filter((id) => id !== friendId);
    if (activeChat.value?.friend.id === friendId) {
      activeChat.value = undefined;
    }
  }

  /** Clears the cache only — the server keeps every transcript. */
  function reset() {
    chats.value = new Map();
    order.value = [];
    activeChat.value = undefined;
    isHydrated.value = false;
  }

  function promote(peerId: number) {
    order.value = [peerId, ...order.value.filter((id) => id !== peerId)];
  }

  return {
    chats,
    orderedChats,
    activeChat,
    isHydrated,
    hydrate,
    selectChat,
    closeChat,
    ensureChat,
    createChat,
    loadFirstPage,
    loadOlder,
    addOptimistic,
    markFailed,
    ingestMessage,
    applyReadReceipt,
    markRead,
    deleteChat,
    getChat,
    reset,
  };
});
