<script setup lang="ts">
import type { HTMLAttributes } from 'vue';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';

const props = defineProps<{
  image?: string | null;
  username: string;
  class?: HTMLAttributes['class'];
}>();
</script>

<template>
  <Avatar :class="props.class">
    <AvatarImage v-if="image" :src="image" :alt="username" />
    <AvatarFallback
      >{{ username.charAt(0) }}{{ username.charAt(username.length - 1) }}</AvatarFallback
    >
  </Avatar>
</template>
