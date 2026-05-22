import { onMounted, onUnmounted, ref } from 'vue';

const isMuted = ref(true);
const isFullscreen = ref(false);

export function useVideoPlayer() {
  function toggleVolume() {
    isMuted.value = !isMuted.value;
  }

  function toggleFullscreen(container: HTMLDivElement) {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      container.requestFullscreen();
    }
  }

  function syncFullscreenState() {
    isFullscreen.value = !!document.fullscreenElement;
  }

  onMounted(() => {
    document.addEventListener('fullscreenchange', syncFullscreenState);
  });

  onUnmounted(() => {
    document.removeEventListener('fullscreenchange', syncFullscreenState);
  });

  return { isMuted, toggleVolume, isFullscreen, toggleFullscreen };
}