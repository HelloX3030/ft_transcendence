<script setup lang="ts">
import { onMounted } from 'vue';
import ChatListBox from '@/components/chat/ChatListBox.vue';

import ChatWindow from '@/components/chat/ChatWindow.vue';
import { useChatStore } from '@/stores/chat';

const chatStore = useChatStore();

// The socket hydrates on connect, but a hard reload straight onto /chat can
// render before that lands.
onMounted(() => {
  if (!chatStore.isHydrated) void chatStore.hydrate();
});
</script>

<template>
  <div class="flex min-w-0 h-[calc(100vh-var(--header-height))]">
    <ChatListBox />
    <ChatWindow />
  </div>
</template>
