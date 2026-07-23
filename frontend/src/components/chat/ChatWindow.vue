<script setup lang="ts">
import { Send, ArrowLeft } from 'lucide-vue-next';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import type { Chat } from '@/composables/chat/useChatList';
import { useChatMessages } from '@/composables/chat/useChatConversation';
import { computed } from 'vue';
import { useNotifyStore } from '@/stores/notify';

const props = defineProps<{
  chat: Chat;
  usersLoading: boolean;
}>();

const emit = defineEmits<{ close: [] }>();
const notify = useNotifyStore();
const chatRef = computed(() => props.chat);
const { currentUserId, newMessage, sendMessage, getMessageClass, formatTime, messagesEndRef } =
  useChatMessages(chatRef);
</script>

<template>
  <header class="p-4 border-b border-white/10 flex items-center gap-3">
    <Button variant="ghost" size="icon" class="sm:hidden -ml-2" @click="emit('close')">
      <ArrowLeft class="h-5 w-5" />
    </Button>

    <Avatar class="h-9 w-9">
      <AvatarImage v-if="getUser(chat.userId)?.image" :src="getUser(chat.userId)!.image!" />
      <AvatarFallback>
        {{ getUser(chat.userId)?.username.charAt(0) ?? '?' }}
      </AvatarFallback>
    </Avatar>
    <Skeleton v-if="usersLoading" class="h-4 w-24" />
    <span v-else class="font-medium">
      {{ getUser(chat.userId)?.username ?? chat.userId }}
    </span>
  </header>

  <ScrollArea class="flex-1 p-4">
    <div
      v-if="chat.messages.length === 0"
      class="h-full flex items-center justify-center text-muted-foreground text-sm text-center"
    >
      Say hi to {{ getUser(chat.userId)?.username ?? 'your friend' }} 👋
    </div>
    <div v-else class="flex flex-col gap-2">
      <div
        v-for="(msg, i) in chat.messages"
        :key="i"
        class="max-w-[85%] sm:max-w-[70%] flex flex-col"
        :class="getMessageClass(msg)"
      >
        <div
          v-if="msg.senderId !== notify.SYSTEM_SENDER_ID"
          class="rounded-2xl px-4 py-2 text-sm"
          :class="
            msg.senderId === currentUserId ? 'bg-orange-500 text-black' : 'bg-white/10 text-white'
          "
        >
          {{ msg.message }}
        </div>
        <div v-else class="px-4 py-2 text-sm text-white">
          {{ msg.message }}
        </div>
        <span
          v-if="msg.senderId !== notify.SYSTEM_SENDER_ID"
          class="text-[11px] text-muted-foreground mt-1"
        >
          {{ formatTime(msg.timestamp) }}
        </span>
      </div>
      <div ref="messagesEndRef" />
    </div>
  </ScrollArea>

  <form
    @submit.prevent="sendMessage"
    class="p-4 border-t sticky bottom-0 bg-background border-white/10 flex gap-2"
  >
    <Input v-model="newMessage" placeholder="Type a message..." class="flex-1" />
    <Button type="submit" size="icon">
      <Send class="h-4 w-4" />
    </Button>
  </form>
</template>
