import { ref } from 'vue';
import { toast } from 'vue-sonner';
import { type Chat, useChatStore } from '@/stores/chat';
import { useNotifyStore } from '@/stores/notify';
import { useUserStore } from '@/stores/user';

/** Unique enough to match an echo back to its optimistic render. */
function newClientMsgId() {
  return (
    globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
}

export function useSendMessage() {
  const notifyStore = useNotifyStore();
  const chatStore = useChatStore();
  const userStore = useUserStore();

  const inputMsg = ref('');

  async function sendMessage(chat: Chat) {
    const body = inputMsg.value.trim();
    const senderId = userStore.state?.id;
    if (!body || senderId === undefined) return;

    // Render first, reconcile later: the message appears instantly and is
    // matched back up on clientMsgId when the ack or the broadcast echo lands,
    // so the sending tab never renders it twice.
    const clientMsgId = newClientMsgId();
    chatStore.addOptimistic(chat, clientMsgId, body, senderId);
    inputMsg.value = '';

    const ack = await notifyStore.sendChatMsg(chat.friend.id, body, clientMsgId);
    if (!ack.ok) {
      // A rejected send is an error state on the message, not a fake message
      // from a system sender.
      chatStore.markFailed(chat, clientMsgId);
      toast.error(ack.error);
      return;
    }
    chatStore.ingestMessage(ack.message);
  }

  return { inputMsg, sendMessage };
}
