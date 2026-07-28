<script setup lang="ts">
import { computed } from 'vue';
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
import { useNotifyStore } from '@/stores/notify';
import UserAvatar from '../UserAvatar.vue';
import { formatTime } from '@/lib/format.ts';

const props = defineProps<Chat>();

const notifyStore = useNotifyStore();
const userStore = useUserStore();
const { state: user } = storeToRefs(userStore);

const groupedMessages = computed(() => {
  const groups: { senderId: number; messages: typeof props.messages }[] = [];

  for (const message of props.messages) {
    if (message.senderId === notifyStore.SYSTEM_SENDER_ID) {
      // toast.warning(message.message);
      continue;
    }
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
        <template v-if="isMine(group.senderId)">
          <UserAvatar v-if="user" :image="user.image" :username="user.username" />
        </template>
        <template v-else>
          <UserAvatar :image="friend.image" :username="friend.username" />
        </template>
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
