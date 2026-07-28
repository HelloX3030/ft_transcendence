import { ref } from 'vue';
import { storeToRefs } from 'pinia';
import { useUserStore } from '@/stores/user';
import { useChatStore, type Chat } from '@/stores/chat';
import { useNotifyStore } from '@/stores/notify';

export function useSendMessage() {
  const chatStore = useChatStore();
  const notifyStore = useNotifyStore();
  const userStore = useUserStore();
  const { state: user } = storeToRefs(userStore);

  const inputMsg = ref('');

  function sendMessage(chat: Chat) {
    if (!inputMsg.value.trim() || !user.value) return;
    chatStore.addMessage(chat, user.value.id, inputMsg.value.trim());
    notifyStore.sendChatMsg(chat.friend.id, inputMsg.value.trim());
    inputMsg.value = '';
  }

  return { inputMsg, sendMessage };
}
