import { ref } from 'vue';
import { type Chat } from '@/stores/chat';
import { useNotifyStore } from '@/stores/notify';

export function useSendMessage() {
  const notifyStore = useNotifyStore();

  const inputMsg = ref('');

  function sendMessage(chat: Chat) {
    if (!inputMsg.value.trim()) return;

    // No local echo: the gateway relays the message back to every tab of the
    // sender, so appending it here as well would render it twice.
    notifyStore.sendChatMsg(chat.friend.id, inputMsg.value.trim());
    inputMsg.value = '';
  }

  return { inputMsg, sendMessage };
}
