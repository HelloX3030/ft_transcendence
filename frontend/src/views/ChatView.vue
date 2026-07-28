<script setup lang="ts">
import ChatListBox from '@/components/chat/ChatListBox.vue';

import ChatWindow from '@/components/chat/ChatWindow.vue';
</script>

<template>
  <div class="flex h-[calc(100vh-var(--header-height))]">
    <ChatListBox />
    <ChatWindow />
  </div>
</template>
