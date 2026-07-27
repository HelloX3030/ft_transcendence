<script setup lang="ts">
import { Send, ArrowLeft } from 'lucide-vue-next';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import ChatListBox from '@/components/chat/ChatListBox.vue';
import { useUserStore } from '@/stores/user';
import { storeToRefs } from 'pinia';
import { useChatStore, type Chat } from '@/stores/chat';
import { useNotifyStore } from '@/stores/notify';
import { ref } from 'vue';
import ChatMessage from '@/components/chat/ChatMessage.vue';

const notifyStore = useNotifyStore();
const chatStore = useChatStore();

const { activeChat } = storeToRefs(chatStore);
const userStore = useUserStore();
const { state: user } = storeToRefs(userStore);

const inputMsg = ref('');

function handleSendMsg(chat: Chat) {
  chatStore.addMessage(chat, user.value!.id, inputMsg.value);
  notifyStore.sendChatMsg(chat.friend.id, inputMsg.value);
  inputMsg.value = '';
}
</script>

<template>
  <div class="flex h-full">
    <!-- Left column: Search + Chat list -->
    <ChatListBox />

    <!-- Right column: Active chat -->
    <section class="flex-1 flex-col relative" :class="activeChat ? 'flex' : 'hidden sm:flex'">
      <template v-if="activeChat">
        <div class="p-4 border-b border-white/10 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            class="sm:hidden -ml-2"
            @click="activeChat = undefined"
          >
            <ArrowLeft class="h-5 w-5" />
          </Button>

          <Avatar class="h-9 w-9">
            <AvatarImage v-if="activeChat.friend.image" :src="activeChat.friend.image" />
            <AvatarFallback>
              {{ activeChat.friend.username.charAt(0) ?? '?' }}
            </AvatarFallback>
          </Avatar>
          <Skeleton v-if="false" class="h-4 w-24" />
          <span v-else class="font-medium">
            {{ activeChat.friend.username }}
          </span>
        </div>

        <ScrollArea class="p-4 flex-1">
          <div
            v-if="activeChat.messages.length === 0"
            class="h-full flex items-center justify-center text-muted-foreground text-sm text-center"
          >
            Say hi to {{ activeChat.friend.username ?? 'your friend' }} 👋
          </div>

          <ChatMessage v-bind="activeChat" />
        </ScrollArea>

        <form
          @submit.prevent="handleSendMsg(activeChat)"
          class="p-4 border-t sticky bottom-0 bg-background border-white/10 flex gap-2"
        >
          <Input v-model="inputMsg" placeholder="Type a message..." class="flex-1" />
          <Button type="submit" size="icon">
            <Send />
          </Button>
        </form>
      </template>

      <div v-else class="flex-1 items-center justify-center text-muted-foreground hidden sm:flex">
        Select a chat to get started.
      </div>
    </section>
  </div>
</template>
