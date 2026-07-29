<script setup lang="ts">
import { computed } from 'vue';
import { Send, ArrowLeft, Dot } from '@lucide/vue';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { storeToRefs } from 'pinia';
import { useChatStore } from '@/stores/chat';
import { useNotifyStore } from '@/stores/notify';
import ChatMessage from '@/components/chat/ChatMessage.vue';
import { useSendMessage } from '@/composables/chat/useSendMessage';
import UserAvatar from '../UserAvatar.vue';

const chatStore = useChatStore();
const notifyStore = useNotifyStore();
const { activeChat } = storeToRefs(chatStore);

// The gateway refuses to relay to an offline peer, so sending would come straight
// back as a system error in the transcript. Block it at the composer instead.
const peerOnline = computed(() =>
  activeChat.value ? notifyStore.isUserOnline(activeChat.value.friend.id) : false,
);

const { inputMsg, sendMessage } = useSendMessage();
</script>

<template>
  <section class="flex-1 flex-col relative min-h-0" :class="activeChat ? 'flex' : 'hidden sm:flex'">
    <template v-if="activeChat">
      <div class="p-4 border-b border-white/10 flex items-center gap-3">
        <Button variant="ghost" size="icon" class="sm:hidden -ml-2" @click="chatStore.closeChat()">
          <ArrowLeft class="h-5 w-5" />
        </Button>

        <UserAvatar :image="activeChat.friend.image" :username="activeChat.friend.username" />
        <span class="font-medium">{{ activeChat.friend.username }}</span>

        <div class="flex items-center">
          <Dot :class="peerOnline ? 'text-green-400' : 'text-red-600'" />
          <span class="text-muted-foreground text-sm">
            {{ peerOnline ? 'online' : 'offline' }}
          </span>
        </div>
      </div>

      <ScrollArea class="p-4 flex-1 min-h-0">
        <div
          v-if="activeChat.messages.length === 0"
          class="h-full flex items-center justify-center text-muted-foreground text-sm text-center"
        >
          Say hi to {{ activeChat.friend.username }} 👋
        </div>
        <ChatMessage v-else v-bind="activeChat" />
      </ScrollArea>

      <form
        @submit.prevent="sendMessage(activeChat)"
        class="p-4 border-t sticky bottom-0 bg-background border-white/10 flex gap-2"
      >
        <Input
          v-model="inputMsg"
          :disabled="!peerOnline"
          :placeholder="
            peerOnline ? 'Type a message...' : `${activeChat.friend.username} is offline`
          "
          class="flex-1"
        />
        <Button type="submit" size="icon" :disabled="!peerOnline">
          <Send />
        </Button>
      </form>
    </template>

    <div v-else class="flex-1 items-center justify-center text-muted-foreground hidden sm:flex">
      Select a chat to get started.
    </div>
  </section>
</template>
