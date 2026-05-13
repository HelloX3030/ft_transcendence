<script setup lang="ts">
import { onMounted, ref, useTemplateRef, watch } from 'vue';
import { useVideoPlayer } from '@/composables/useVideoPlayer';
import Controls from './Controls.vue';

interface PropsType {
  title: string;
  videoId: string;
  controls?: boolean;
  active: boolean;
}

const props = defineProps<PropsType>();

const container = useTemplateRef('video-container');
const player = ref<YT.Player>();
const isPlaying = ref(false);
const { isMuted, toggleFullscreen } = useVideoPlayer();

onMounted(() => {
  const init = () => {
    player.value = new window.YT.Player(`player-${props.videoId}`, {
      videoId: props.videoId,
      playerVars: {
        controls: 0,
        rel: 0,
        modestbranding: 0,
        autoplay: props.active ? 1 : 0,
        mute: 1,
      },
      events: {
        onStateChange: (e) => {
          isPlaying.value = e.data === window.YT.PlayerState.PLAYING;
        },
      },
    });
  };
  if (window.YT?.Player) {
    init();
  } else {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      init();
    };
  }
});

watch(
  () => props.active,
  (isActive) => {
    if (!player.value) return;
    if (isActive) {
      player.value.playVideo();
    } else {
      player.value.pauseVideo();
    }
  },
); //TODO: search for better solution

watch(isMuted, (muted) => {
  if (!player.value) return;
  muted ? player.value.mute() : player.value.unMute();
});

function togglePlay() {
  if (!player.value) return;
  isPlaying.value ? player.value.pauseVideo() : player.value.playVideo();
}
</script>

<template>
  <div ref="video-container" class="h-full relative overflow-hidden">
    <div class="absolute inset-0 z-10" @click="togglePlay" />
    <Controls @fullscreen-event="toggleFullscreen(container!)" />
    <div :id="`player-${videoId}`" class="w-full h-full lg:scale-y-125 scale-y-150" />
  </div>
</template>
