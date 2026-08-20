<script setup lang="ts">
import type { HTMLAttributes } from 'vue';
import { computed } from 'vue';
import { fileUrl } from '@/lib/files';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';

const props = defineProps<{
  /** Id of the stored avatar; the URL is built here, never sent by the backend. */
  avatarFileId?: number | null;
  /**
   * Overrides the id-derived URL. The edit view previews a locally picked file
   * from an object URL, which has no file id yet.
   */
  src?: string | null;
  username?: string | null;
  class?: HTMLAttributes['class'];
}>();

const resolvedSrc = computed(() => props.src ?? fileUrl(props.avatarFileId));

const initials = computed(() => props.username?.slice(0, 2).toUpperCase() || '??');
</script>

<template>
  <!--
    Keyed on the source so the root remounts when the avatar goes away.

    reka-ui's AvatarRoot holds a shared imageLoadingStatus: AvatarImage sets it
    to 'loaded' and AvatarFallback renders only while it is not. Nothing ever
    resets it, so once AvatarImage unmounts after a delete the root stays stuck
    on 'loaded' and the fallback never appears, an empty circle where the
    initials should be.
  -->
  <Avatar :key="resolvedSrc ?? 'fallback'" :class="props.class">
    <AvatarImage v-if="resolvedSrc" :src="resolvedSrc" :alt="username ?? 'Avatar'" />
    <!-- Font size is inherited, so a caller's `class` sizes the initials too. -->
    <AvatarFallback>{{ initials }}</AvatarFallback>
  </Avatar>
</template>
