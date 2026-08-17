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
import UserAvatar from '../UserAvatar.vue';
import UserAvatarLink from '../UserAvatarLink.vue';
import { formatTime } from '@/lib/format.ts';

const props = defineProps<Chat>();

const userStore = useUserStore();
const { state: user } = storeToRefs(userStore);

const groupedMessages = computed(() => {
  const groups: { senderId: number; messages: typeof props.messages }[] = [];

  for (const message of props.messages) {
    const lastGroup = groups.at(-1);
    if (lastGroup && lastGroup.senderId === message.senderUserId) {
      lastGroup.messages.push(message);
    } else {
      groups.push({ senderId: message.senderUserId, messages: [message] });
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
          <UserAvatar v-if="user" :avatar-file-id="user.avatarFileId" :username="user.username" />
        </template>
        <template v-else>
          <UserAvatarLink
            :user-id="friend.id"
            :avatar-file-id="friend.avatarFileId"
            :username="friend.username"
          />
        </template>
      </MessageAvatar>

      <MessageContent>
        <MessageHeader v-if="!isMine(group.senderId)">{{ friend.username }}</MessageHeader>

        <Bubble
          v-for="message in group.messages"
          :key="message.clientMsgId ?? message.id"
          :variant="isMine(group.senderId) ? 'default' : 'muted'"
          :class="{
            'opacity-60': message.status === 'pending',
            'opacity-60 ring-1 ring-destructive': message.status === 'failed',
          }"
        >
          <!-- wrap-anywhere, not the primitive's wrap-break-word: only
               overflow-wrap: anywhere reduces min-content width, so an
               unbreakable token actually wraps instead of keeping its full
               width in layout and being clipped by the bubble's overflow. -->
          <BubbleContent class="wrap-anywhere">{{ message.body }}</BubbleContent>
        </Bubble>

        <MessageFooter>
          <span v-if="group.messages.some((m) => m.status === 'failed')" class="text-destructive">
            Not delivered
          </span>
          <span v-else>{{ formatTime(group.messages.at(-1)!.createdAt) }}</span>
        </MessageFooter>
      </MessageContent>
    </Message>
  </div>
</template>
