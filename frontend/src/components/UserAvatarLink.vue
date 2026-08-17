<script setup lang="ts">
import type { HTMLAttributes } from 'vue';
import UserAvatar from './UserAvatar.vue';

// An avatar that opens the person it belongs to. Wherever a user is shown, the
// picture is the thing people click, so it links rather than sitting inert.
const props = defineProps<{
  userId: number;
  avatarFileId?: number | null;
  username?: string | null;
  /** Sizes the avatar, not the link. */
  class?: HTMLAttributes['class'];
}>();
</script>

<template>
  <!-- `relative`: a caller may badge the avatar through the default slot, the
       way FriendItem overlays its presence dot. -->
  <RouterLink
    :to="`/users/${userId}`"
    :aria-label="username ? `Open ${username}'s profile` : 'Open profile'"
    class="relative inline-flex rounded-full outline-none transition-opacity hover:opacity-80 focus-visible:ring-[3px] focus-visible:ring-ring/50"
  >
    <UserAvatar :avatar-file-id="avatarFileId" :username="username" :class="props.class" />
    <slot />
  </RouterLink>
</template>
