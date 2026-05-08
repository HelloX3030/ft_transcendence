import { ref } from "vue";

const isMuted = ref(true);

export function useVideoPlayer() {
  function toggleVolume() {
    isMuted.value = !isMuted.value;
  }

  return { isMuted, toggleVolume };
}
