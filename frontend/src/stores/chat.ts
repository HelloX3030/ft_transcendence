import { defineStore } from 'pinia';
import { useNotifyStore } from './notify';
import { computed, ref, watch } from 'vue';
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

  watch(chats, (c) => {
    console.log(c.entries);
  });
  watch(activeChat, (c) => {
    console.log(c?.messages);
  });

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

  function createChat(friend: GetUserResponse) {
    const chat = chats.value.get(friend.id) ?? { friend, messages: [] };
    chats.value.set(friend.id, chat);
    selectChat(chat);
    return chat;
  }

  function addMessage(chat: Chat, senderId: number, message: string) {
    chat.messages.push({
      timestamp: new Date().toISOString(),
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

  return {
    chats,
    sortedChats,
    activeChat,
    selectChat,
    closeChat,
    createChat,
    addMessage,
    deleteChat,
    getChat,
  };
});
