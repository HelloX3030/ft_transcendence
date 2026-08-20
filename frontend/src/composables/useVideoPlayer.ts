import { ref, onMounted, onBeforeUnmount, watch, type Ref } from 'vue';
import { loadYouTubeApi } from '@/lib/youtube';

const isMuted = ref(true);
const isFullscreen = ref(false);

export function useGlobalVideoPlayer() {
  function toggleVolume() {
    isMuted.value = !isMuted.value;
  }

  return { isMuted, isFullscreen, toggleVolume };
}

export function useVideoPlayer(
  activeRef: Ref<boolean>,
  containerRef: Ref<HTMLElement | null>,
  // An iframe, not any element: handed anything else the API builds its own and
  // writes an `allow` attribute onto it that every browser warns about.
  hostRef: Ref<HTMLIFrameElement | null>,
) {
  const player = ref<YT.Player>();
  const isPlaying = ref(false);
  const showInfo = ref(true);
  // The player's methods (playVideo, mute, destroy) only exist once the embed
  // has loaded and onReady has fired, so every caller waits on this.
  const isReady = ref(false);
  // Set once the component is gone. An embed that finishes loading after that
  // has no card left to play on, so the teardown is deferred to onReady.
  let disposed = false;
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

  /**
   * Resolves once the iframe holds its YouTube document. A freshly inserted
   * iframe still has `about:blank` in it, and the API's handshake poll aims each
   * `postMessage` at the embed's host, so every tick before the real document
   * commits is refused by the browser and logged.
   */
  function iframeLoaded(frame: HTMLIFrameElement): Promise<void> {
    // A committed cross-origin document makes contentDocument null; while the
    // iframe still holds about:blank it is same-origin and readable. Without this
    // a load that beat us here would wait forever.
    if (frame.contentDocument === null) return Promise.resolve();
    return new Promise((resolve) => {
      frame.addEventListener('load', () => resolve(), { once: true });
    });
  }

  async function initPlayer() {
    await loadYouTubeApi();
    // Awaiting yields to the microtask queue, so a card unmounted while the API
    // was loading arrives here with `disposed` already set. The element is passed
    // rather than an id: a trailer key is not unique across the feed, and two
    // cards sharing one would put two nodes under the same id.
    if (disposed || !hostRef.value) return;

    await iframeLoaded(hostRef.value);
    // Swiped past while the embed was loading: there is nothing left to drive,
    // and constructing a player here would only build one to destroy.
    if (disposed || !hostRef.value) return;

    // The iframe already carries the video, the parameters and the host (see
    // `embedUrl`): on the existing-iframe path the API reads none of them and
    // never builds a URL, so only the events are its business. What is left in
    // the console comes from YouTube's own document and cannot be suppressed
    // from the embedding side.
    player.value = new window.YT.Player(hostRef.value, {
      events: {
        onReady: (event) => {
          // Swiped past while it was still loading. event.target rather than
          // player.value, which the unmount already cleared.
          if (disposed) {
            event.target.destroy();
            return;
          }
          isReady.value = true;
          // The card may have been swiped onto, or the sound toggled, while the
          // embed loaded. Apply the state as it is now.
          syncMuted();
          syncActive();
        },
        onStateChange: (e) => {
          isPlaying.value = e.data === window.YT.PlayerState.PLAYING;
        },
      },
    });
  }

  function togglePlay() {
    if (!isReady.value || !player.value) return;
    if (isPlaying.value) player.value.pauseVideo();
    else player.value.playVideo();
  }

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

  // Owned here rather than in the component: both need the readiness gate, and
  // the component had no way to know about it.
  watch(activeRef, syncActive);
  watch(isMuted, syncMuted);

  onMounted(() => {
    void initPlayer();
    startHideTimer();

    if (screen.orientation) {
      screen.orientation.addEventListener('change', handleOrientationChange);
    } else {
      window.addEventListener('orientationchange', handleOrientationChange);
    }
  });
  // onBeforeUnmount, not onUnmounted: destroy() has to run while the iframe is
  // still in the document, and Vue has detached it by the time onUnmounted fires.
  onBeforeUnmount(() => {
    disposed = true;
    clearTimeout(hideTimer);
    // destroy() is one of the methods that only exists once onReady has fired.
    // onReady above finishes the teardown for a player still loading.
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
