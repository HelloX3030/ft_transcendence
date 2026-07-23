import { computed, nextTick, ref, watch, type Ref } from 'vue';
import { storeToRefs } from 'pinia';
import { useUserStore } from '@/stores/user';
import { useNotifyStore } from '@/stores/notify';
import type { Chat, ChatMessage } from './useChatList';

export function useChatConversation(selectedChat: Ref<Chat | undefined>) {
  const userStore = useUserStore();
  const { state: user } = storeToRefs(userStore);
  const currentUserId = computed(() => user.value?.id.toString() ?? '');

  const notify = useNotifyStore();

  const newMessage = ref('');

  function sendMessage() {
    if (!newMessage.value.trim() || !selectedChat.value) return;

    const peerUserId = selectedChat.value.userId;
    const messageText = newMessage.value.trim();

    const existing = notify.chat.get(peerUserId.toString()) ?? [];
    existing.push({
      timestamp: new Date().toISOString(),
      senderId: currentUserId.value,
      message: messageText,
    });
    notify.chat.set(peerUserId.toString(), existing);

    notify.sendChatMsg(peerUserId, messageText);
    newMessage.value = '';
  }

  function getMessageClass(msg: ChatMessage) {
    if (msg.senderId === currentUserId.value) {
      return 'self-end items-end';
    } else if (msg.senderId === notify.SYSTEM_SENDER_ID) {
      return 'self-center items-center';
    } else {
      return 'self-start items-start';
    }
  }

  const messagesEndRef = ref<HTMLElement | null>(null);

  function scrollToBottom() {
    nextTick(() => {
      messagesEndRef.value?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    });
  }

  watch(() => [selectedChat.value?.userId, selectedChat.value?.messages.length], scrollToBottom);

  return {
    currentUserId,
    newMessage,
    sendMessage,
    getMessageClass,
    messagesEndRef,
    systemSenderId: notify.SYSTEM_SENDER_ID,
  };
}
