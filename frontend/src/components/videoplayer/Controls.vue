<script setup lang="ts">
import { ButtonGroup } from '@/components/ui/button-group';
import { Bookmark, Heart, Maximize, Minimize, ThumbsDown, Volume2, VolumeOff, X } from 'lucide-vue-next';

import { useVideoPlayer } from '@/composables/useVideoPlayer';
import { Button } from '../ui/button';

import { ref } from 'vue';

const { toggleVolume, isMuted, isFullscreen } = useVideoPlayer();
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


function toggleSave()
{
  isSaved.value = !(isSaved.value)
}
</script>

<template>

  <!-- TOP RIGHT : SOUND -->
  <div class="absolute portrait:top-5 landscape:top-4 right-5 z-30">
    <Button
      @click="toggleVolume"
      variant="outline"
      class="rounded-full w-11 h-11 flex items-center justify-center"
    >
      <VolumeOff v-if="isMuted" 
        class="size-5"/>
      <Volume2 v-else 
        class="size-5"/>
    </Button>
  </div>

  <!-- CENTER RIGHT : SOCIAL -->
  <div
    class="absolute top-1/2 right-5 -translate-y-1/2 z-30 flex flex-col portrait:gap-10 landscape:gap-4"
  >
    <Button @click="toggleLike"
      variant="outline"
      class="rounded-full w-11 h-11 flex items-center justify-center"
    >
      <Heart 
        :class="[isLiked ? 'text-red-500 fill-red-500' : '', 'size-5']" 
      />
    </Button>

    <Button @click="toggleDislike"
      variant="outline"
      class="rounded-full w-11 h-11 flex items-center justify-center"
    >
      <X
        :class="[isDisliked ? 'text-blue-400 fill-blue-400' : '', 'size-5']"
      />
    </Button>

    <Button @click="toggleSave"
      variant="outline"
      class="rounded-full w-11 h-11 flex items-center justify-center"
    >
      <Bookmark 
        :class="[isSaved ? 'text-yellow-400 fill-yellow-400' : '', 'size-5']"
      
      />
    </Button>
  </div>

  <!-- BOTTOM RIGHT : FULLSCREEN -->
  <div class="absolute portrait:bottom-5 landscape:bottom-4 right-5 z-30">
    <Button
      variant="outline"
      @click="$emit('fullscreen-event')"
      class="rounded-full w-11 h-11 flex items-center justify-center"
    >
      <Minimize v-if="isFullscreen" 
        class="size-5"/>
      <Maximize v-else 
        class="size-5"/>
    </Button>
  </div>
</template>

