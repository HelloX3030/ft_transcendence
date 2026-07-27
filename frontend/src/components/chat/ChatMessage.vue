<script setup lang="ts">
import { computed } from 'vue';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Bubble, BubbleContent } from '@/components/ui/bubble';
import {
  Message,
  MessageAvatar,
  MessageContent,
  MessageFooter,
  MessageHeader,
} from '@/components/ui/message';
import type { Chat } from '@/stores/chat';
import { useUserStore } from '@/stores/user';
import { storeToRefs } from 'pinia';

const props = defineProps<Chat>();

const userStore = useUserStore();
const { state: user } = storeToRefs(userStore);

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

const groupedMessages = computed(() => {
  const groups: { senderId: number; messages: typeof props.messages }[] = [];

  for (const message of props.messages) {
    const lastGroup = groups.at(-1);
    if (lastGroup && lastGroup.senderId === message.senderId) {
      lastGroup.messages.push(message);
    } else {
      groups.push({ senderId: message.senderId, messages: [message] });
    }
  }

  return groups;
});

function isMine(senderId: number) {
  return senderId === user.value?.id;
}
</script>

<template>
  <div class="flex w-full flex-col gap-6 py-12">
    <Message
      v-for="group in groupedMessages"
      :key="group.senderId"
      :align="isMine(group.senderId) ? 'end' : 'start'"
    >
      <MessageAvatar>
        <Avatar>
          <template v-if="isMine(group.senderId)">
            <AvatarImage v-if="user?.image" :src="user.image" alt="@me" />
            <AvatarFallback>ME</AvatarFallback>
          </template>
          <template v-else>
            <AvatarImage v-if="friend.image" :src="friend.image" :alt="friend.username" />
            <AvatarFallback>{{ friend.username.charAt(0) ?? '?' }}</AvatarFallback>
          </template>
        </Avatar>
      </MessageAvatar>

      <MessageContent>
        <MessageHeader v-if="!isMine(group.senderId)">{{ friend.username }}</MessageHeader>

        <Bubble
          v-for="message in group.messages"
          :key="message.timestamp"
          :variant="isMine(group.senderId) ? 'default' : 'muted'"
        >
          <BubbleContent>{{ message.message }}</BubbleContent>
        </Bubble>

        <MessageFooter>{{ formatTime(group.messages.at(-1)!.timestamp) }}</MessageFooter>
      </MessageContent>
    </Message>
  </div>
</template>
