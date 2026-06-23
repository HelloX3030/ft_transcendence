<script setup lang="ts">
import { Bookmark, Heart, Maximize, Minimize, Volume2, VolumeOff, X } from '@lucide/vue';

import { Button } from '../ui/button';
import { ref } from 'vue';
import { useGlobalVideoPlayer } from '@/composables/useVideoPlayer';

defineEmits(['fullscreen-event']);

const { isMuted, isFullscreen, toggleVolume } = useGlobalVideoPlayer();
const isLiked = ref(false);
const isDisliked = ref(false);
const isSaved = ref(false);

function toggleLike() {
  isLiked.value = !isLiked.value;

  if (isLiked.value) {
    isDisliked.value = false;
  }
}

function toggleDislike() {
  isDisliked.value = !isDisliked.value;

  if (isDisliked.value) {
    isLiked.value = false;
  }
}

function toggleSave() {
  isSaved.value = !isSaved.value;
}
</script>

<template>
  <!-- TOP RIGHT : SOUND -->
  <div>
    <div class="absolute top-6 short:top-5 md:top-10 right-6 z-30">
      <Button
        @click="toggleVolume"
        variant="outline"
        class="rounded-full size-11 md:size-11 flex items-center justify-center"
      >
        <VolumeOff v-if="isMuted" class="size-5 md:size-6" />
        <Volume2 v-else class="size-5 md:size-6" />
      </Button>
    </div>

    <!-- CENTER RIGHT : SOCIAL -->
    <div
      class="absolute top-1/2 right-6 -translate-y-1/2 z-30 flex flex-col gap-5 short:gap-3 md:gap-8"
    >
      <Button
        @click="toggleLike"
        variant="outline"
        class="rounded-full size-11 md:size-11 flex items-center justify-center"
      >
        <Heart :class="[isLiked ? 'text-red-500 fill-red-500' : '', 'size-5 md:size-6']" />
      </Button>

      <Button
        @click="toggleDislike"
        variant="outline"
        class="rounded-full size-11 md:size-11 flex items-center justify-center"
      >
        <X :class="[isDisliked ? 'text-blue-400 fill-blue-400' : '', 'size-5 md:size-6']" />
      </Button>

      <Button
        @click="toggleSave"
        variant="outline"
        class="rounded-full size-11 md:size-11 flex items-center justify-center"
      >
        <Bookmark :class="[isSaved ? 'text-yellow-400 fill-yellow-400' : '', 'size-5 md:size-6']" />
      </Button>
    </div>

    <!-- BOTTOM RIGHT : FULLSCREEN -->
    <div class="absolute bottom-6 short:bottom-5 md:bottom-10 right-6 z-30">
      <Button
        variant="outline"
        @click="$emit('fullscreen-event')"
        class="rounded-full size-11 md:size-11 flex items-center justify-center"
      >
        <Minimize v-if="isFullscreen" class="size-5 md:size-6" />
        <Maximize v-else class="size-5 md:size-6" />
      </Button>
    </div>
  </div>
</template>
