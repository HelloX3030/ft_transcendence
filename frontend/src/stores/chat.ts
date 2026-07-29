import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import type { GetUserResponse } from '@trailertinder/shared';

interface ChatMessage {
  timestamp: string;
  senderId: number;
  message: string;
}

export interface Chat {
  friend: GetUserResponse;
  messages: ChatMessage[];
}

export const useChatStore = defineStore('chat', () => {
  const chats = ref(new Map<number, Chat>());
  const activeChat = ref<Chat>();

  const sortedChats = computed(() => {
    return Array.from(chats.value.values()).sort((a, b) => {
      const aTime = a.messages.at(-1)?.timestamp;
      const bTime = b.messages.at(-1)?.timestamp;
      if (!aTime && !bTime) return 0;
      if (!aTime) return 1;
      if (!bTime) return -1;
      return new Date(bTime).getTime() - new Date(aTime).getTime();
    });
  });

  function selectChat(chat: Chat) {
    activeChat.value = chat;
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
   *
   * `details` fills in the name and avatar. It is optional because a message can
   * arrive before the friend list has loaded; the placeholder is replaced as
   * soon as the real details turn up.
   */
  function ensureChat(friendId: number, details?: GetUserResponse) {
    const existing = chats.value.get(friendId);
    if (existing) {
      if (details) existing.friend = details;
      return existing;
    }

    const chat: Chat = {
      friend: details ?? { id: friendId, username: `User ${friendId}`, image: null },
      messages: [],
    };
    chats.value.set(friendId, chat);
    return chat;
  }

  function createChat(friend: GetUserResponse) {
    const chat = ensureChat(friend.id, friend);
    selectChat(chat);
    return chat;
  }

  function addMessage(chat: Chat, senderId: number, message: string, timestamp?: string) {
    chat.messages.push({
      timestamp: timestamp ?? new Date().toISOString(),
      senderId,
      message,
    });
  }

  function deleteChat(friendId: number) {
    chats.value.delete(friendId);
    if (activeChat.value?.friend.id === friendId) {
      activeChat.value = undefined;
    }
  }

  /** Clears every transcript, so a logout does not leak chats into the next session. */
  function reset() {
    chats.value = new Map();
    activeChat.value = undefined;
  }

  return {
    chats,
    sortedChats,
    activeChat,
    selectChat,
    closeChat,
    ensureChat,
    createChat,
    addMessage,
    deleteChat,
    getChat,
    reset,
  };
});
