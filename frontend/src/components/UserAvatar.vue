<script setup lang="ts">
import type { HTMLAttributes } from 'vue';
import { computed } from 'vue';
import { fileUrl } from '@/lib/files';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';

const props = defineProps<{
  /** Id of the stored avatar; the URL is built here, never sent by the backend. */
  avatarFileId?: number | null;
  username: string;
  class?: HTMLAttributes['class'];
}>();

const src = computed(() => fileUrl(props.avatarFileId));
</script>

<template>
  <Avatar :class="props.class">
    <AvatarImage v-if="src" :src="src" :alt="username" />
    <AvatarFallback
      >{{ username.charAt(0) }}{{ username.charAt(username.length - 1) }}</AvatarFallback
    >
  </Avatar>
</template>
