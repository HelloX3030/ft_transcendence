<script setup lang="ts">
import { ButtonGroup, ButtonGroupSeparator, ButtonGroupText } from '@/components/ui/button-group';
import { Maximize, Minimize, Play, Volume2, VolumeOff } from 'lucide-vue-next';

import { useVideoPlayer } from '@/composables/useVideoPlayer';
import { Button } from '../ui/button';

const { toggleVolume, isMuted, isFullscreen } = useVideoPlayer();
</script>

<template>
  <ButtonGroup orientation="vertical" class="absolute z-30 top-1/2 right-4 -translate-y-1/2">
    <!-- <Button variant="outline" @click="$emit('play-event')"><Play /></Button> -->
    <Button @click="toggleVolume" variant="outline">
      <VolumeOff v-if="isMuted" />
      <Volume2 v-else />
    </Button>
    <Button variant="outline" @click="$emit('fullscreen-event')">
      <Minimize v-if="isFullscreen" />
      <Maximize v-else />
    </Button>
  </ButtonGroup>
</template>
