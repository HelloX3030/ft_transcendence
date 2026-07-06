import { ref, onMounted, onUnmounted, type Ref } from 'vue';

const isMuted = ref(true);
const isFullscreen = ref(false);

// Global State
export function useGlobalVideoPlayer() {
  function toggleVolume() {
    isMuted.value = !isMuted.value;
  }

  return { isMuted, isFullscreen, toggleVolume };
}

// Instance State
export function useVideoPlayer(
  videoId: string,
  activeRef: Ref<boolean>,
  containerRef: Ref<HTMLElement | null>,
) {
  const player = ref<YT.Player>();
  const isPlaying = ref(false);
  const showInfo = ref(true);
  let hideTimer: ReturnType<typeof setTimeout>;

  // YouTube Init
  function initPlayer() {
    const init = () => {
      player.value = new window.YT.Player(`player-${videoId}`, {
        videoId,
        playerVars: { controls: 0, rel: 0, autoplay: activeRef?.value ? 1 : 0, mute: 1 },
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
  }

  // Play/Pause
  function togglePlay() {
    if (!player.value) return;
    if (isPlaying.value) player.value.pauseVideo();
    else player.value.playVideo();
  }

  // Fullscreen
  function toggleFullscreen() {
    if (!containerRef.value) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
      isFullscreen.value = false;
    } else {
      containerRef.value.requestFullscreen();
      isFullscreen.value = true;
    }
  }

  // Info Timer
  function startHideTimer() {
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      showInfo.value = false;
    }, 5000);
  }

  function handleMouseMove() {
    showInfo.value = true;
    startHideTimer();
  }

  // Orientation
  function handleOrientationChange() {
    if (!activeRef.value || !containerRef?.value) return;
    const isLandscape = screen.orientation
      ? screen.orientation.type.includes('landscape')
      : window.matchMedia('(orientation: landscape)').matches;

    if (isLandscape && !isFullscreen.value) {
      containerRef.value.requestFullscreen();
      isFullscreen.value = true;
    } else if (!isLandscape && isFullscreen.value) {
      document.exitFullscreen();
      isFullscreen.value = false;
    }
  }

  // Lifecycle

  onMounted(() => {
    initPlayer();
    startHideTimer();

    if (screen.orientation) {
      screen.orientation.addEventListener('change', handleOrientationChange);
    } else {
      window.addEventListener('orientationchange', handleOrientationChange);
    }
  });
  onUnmounted(() => {
    clearTimeout(hideTimer);
    if (screen.orientation) {
      screen.orientation.removeEventListener('change', handleOrientationChange);
    } else {
      window.removeEventListener('orientationchange', handleOrientationChange);
    }
  });

  return {
    player,
    isPlaying,
    showInfo,
    togglePlay,
    toggleFullscreen,
    handleMouseMove,
  };
}
