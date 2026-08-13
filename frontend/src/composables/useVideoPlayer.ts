import { ref, onMounted, onUnmounted, watch, type Ref } from 'vue';

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
  // new YT.Player() returns an object whose API methods (playVideo, mute,
  // destroy…) only exist once the embed has loaded and onReady has fired.
  // Calling one before that throws, so every caller waits on this.
  const isReady = ref(false);
  let hideTimer: ReturnType<typeof setTimeout>;

  /** Play or pause to match `activeRef`. No-op until the embed is ready. */
  function syncActive() {
    if (!isReady.value || !player.value) return;
    if (activeRef.value) {
      player.value.playVideo();
      showInfo.value = true;
    } else {
      player.value.pauseVideo();
    }
  }

  /** Apply the global mute setting. No-op until the embed is ready. */
  function syncMuted() {
    if (!isReady.value || !player.value) return;
    if (isMuted.value) player.value.mute();
    else player.value.unMute();
  }

  // YouTube Init
  function initPlayer() {
    const init = () => {
      player.value = new window.YT.Player(`player-${videoId}`, {
        videoId,
        playerVars: {
          controls: 0,
          rel: 0,
          autoplay: activeRef?.value ? 1 : 0,
          mute: 1,
          origin: window.location.origin, //TODO: use env for url
        },
        events: {
          onReady: () => {
            isReady.value = true;
            // The card may have been swiped onto, or the sound toggled, during
            // the seconds the embed took to load. Apply the state as it is now
            // rather than as it was when the player was created.
            syncMuted();
            syncActive();
          },
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
    if (!isReady.value || !player.value) return;
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

  // Owned here rather than in the component: both need the readiness gate, and
  // the component had no way to know about it.
  watch(activeRef, syncActive);
  watch(isMuted, syncMuted);

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
    // destroy() is one of the methods that only exists once onReady has fired.
    // Unmounting a card that is still loading is routine now that players are
    // windowed, so this is a normal path, not an edge case.
    if (isReady.value) player.value?.destroy();
    player.value = undefined;
    isReady.value = false;
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
