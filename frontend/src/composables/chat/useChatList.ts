import { computed, ref } from 'vue';
import { storeToRefs } from 'pinia';
import { useFriendsStore } from '@/stores/friends';
import { useNotifyStore } from '@/stores/notify';

export interface ChatMessage {
  timestamp: string;
  senderId: string;
  message: string;
}

export interface Chat {
  userId: number;
  messages: ChatMessage[];
}

export function useChatList() {
  const friendsStore = useFriendsStore();
  const { friendsDetails, isLoading: friendsLoading } = storeToRefs(friendsStore);

  const notify = useNotifyStore();

  const chats = computed<Chat[]>(() =>
    Array.from(notify.chat, ([userId, messages]) => ({ userId: Number(userId), messages })),
  );

  function getUser(id: number) {
    return friendsDetails.value.find((f) => f.id === id);
  }

  const selectedUserId = ref<number | null>(chats.value[0]?.userId ?? null);

  const selectedChat = computed<Chat | undefined>(() =>
    chats.value.find((c) => c.userId === selectedUserId.value),
  );

  function selectChat(userId: number) {
    selectedUserId.value = userId;
  }

  function closeChat() {
    selectedUserId.value = null;
  }

  const searchQuery = ref('');

  const filteredChats = computed(() => {
    if (!searchQuery.value.trim()) return chats.value;
    const q = searchQuery.value.toLowerCase();
    return chats.value.filter((c) => getUser(c.userId)?.username.toLowerCase().includes(q));
  });

  const friendsWithoutChat = computed(() =>
    friendsDetails.value.filter((friend) => !chats.value.some((c) => c.userId === friend.id)),
  );

  const filteredNewFriends = computed(() => {
    if (!searchQuery.value.trim()) return [];
    const q = searchQuery.value.toLowerCase();
    return friendsWithoutChat.value.filter((friend) => friend.username.toLowerCase().includes(q));
  });

  function startNewChat(userId: number) {
    notify.createChat(userId.toString());
    selectChat(userId);
    searchQuery.value = '';
  }

  const lastMessageOf = (chat: Chat) => chat.messages[chat.messages.length - 1];

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

  return {
    chats,
    getUser,
    friendsLoading,
    selectedUserId,
    selectedChat,
    selectChat,
    closeChat,
    searchQuery,
    filteredChats,
    filteredNewFriends,
    startNewChat,
    lastMessageOf,
    formatTime,
  };
}
