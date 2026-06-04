<script setup lang="ts">
import { useTemplateRef, toRef, watch } from 'vue';
import { useGlobalVideoPlayer, useVideoPlayer } from '@/composables/useVideoPlayer';
import VideoInfo from './VideoInfo.vue';
import Controls from './Controls.vue';
import type { Provider } from '@/lib/test.ts';

const props = defineProps<{
  title: string;
  videoId: string;
  active: boolean;
  genreIds: number[];
  providers: Provider[];
  releaseDate: string;
}>();

const container = useTemplateRef<HTMLElement>('video-container');

const { player, showInfo, togglePlay, toggleFullscreen, handleMouseMove } = useVideoPlayer(
  props.videoId,
  toRef(props, 'active'),
  container,
);

const { isMuted } = useGlobalVideoPlayer();

//TODO: Kann man auch in useVidePlayer auslagern ???
watch(
  () => props.active,
  (isActive) => {
    if (!player.value) return;
    if (isActive) {
      player.value.playVideo();
      showInfo.value = true;
    } else {
      player.value.pauseVideo();
    }
  },
);

watch(isMuted, (muted) => {
  if (!player.value) return;
  muted ? player.value.mute() : player.value.unMute();
});
</script>

<template>
  <div ref="video-container" class="h-full relative overflow-hidden" @mousemove="handleMouseMove">
    <div class="absolute inset-0 z-10" @click="togglePlay" />
    <Controls v-show="showInfo" @fullscreen-event="toggleFullscreen" />
    <VideoInfo
      v-show="showInfo"
      :title="title"
      :genre-ids="genreIds"
      :providers="providers"
      :release-date="releaseDate"
    />
    <div :id="`player-${videoId}`" class="w-full h-full lg:scale-y-125 scale-y-150" />
  </div>
</template>
