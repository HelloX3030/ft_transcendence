<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';

interface PropsType {
  title: string;
  videoId?: string;
  controls?: boolean;
  active: boolean;
}

const props = defineProps<PropsType>();

const player = ref();
const isPlaying = ref(false);

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
);

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

function togglePlay() {
  if (!player.value) return;
  isPlaying.value ? player.value.pauseVideo() : player.value.playVideo();
}
</script>

<template>
  <div class="h-full relative overflow-hidden">
    <div class="absolute inset-0 z-10" @click="togglePlay" />
    <!-- <Button
      class="absolute top-1/2 left-1/2 z-20 -translate-x-1/2 -translate-y-1/2"
      variant="ghost"
      @click="togglePlay"
    ></Button> -->
    <div :id="`player-${videoId}`" class="w-full h-full scale-y-125" />
  </div>
</template>
