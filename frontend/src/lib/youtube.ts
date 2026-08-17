/**
 * Loads the YouTube IFrame API once, on first use, and builds the embed URLs
 * the players are handed.
 *
 * Used to be an app plugin that ran at boot, which meant every user contacted
 * YouTube — and ran its script, and got whatever it logs — on the login screen,
 * on their watchlist, everywhere. The feed is the only thing that needs it.
 */

/**
 * The widget API itself, pinned to a player version and served from the
 * cookie-free host.
 *
 * The unversioned entry point, `https://www.youtube.com/iframe_api`, is a
 * four-line bootstrap whose only real job is to point at this file — and it
 * answers with six Set-Cookie headers, one of them SameSite=lax, which the
 * browser rejects and reports in the console. This URL is the same script with
 * no cookies at all. It calls `onYouTubeIframeAPIReady` itself and guards its
 * one reference to `YTConfig`, so the bootstrap is not needed.
 */
const PINNED_API =
  'https://www.youtube-nocookie.com/s/player/b0d2d49a/www-widgetapi.vflset/www-widgetapi.js';

/** Reached only if the pinned version is ever withdrawn. See `loadYouTubeApi`. */
const FALLBACK_API = 'https://www.youtube.com/iframe_api';

/** Privacy-enhanced host: no identifying cookies until playback. */
const EMBED_HOST = 'https://www.youtube-nocookie.com';

let loading: Promise<typeof window.YT> | null = null;

export function loadYouTubeApi(): Promise<typeof window.YT> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (loading) return loading;

  loading = new Promise((resolve) => {
    // The API calls this global when it is ready. Chained rather than
    // overwritten: nothing else sets it today, and silently dropping someone
    // else's callback is the kind of bug that surfaces months later.
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve(window.YT);
    };

    // Pinning a version trades a console warning for the risk that the version
    // is one day withdrawn — which would mean no trailers at all. The fallback
    // is what makes that trade acceptable: the cookie warning comes back with
    // it, and a warning beats a dead feed.
    loadScript(PINNED_API, () => loadScript(FALLBACK_API));
  });

  return loading;
}

/**
 * No rejection path, deliberately: if both scripts fail there is no player to
 * build and a feed with no player is already what that looks like. Rejecting
 * would only turn a dead embed into an unhandled rejection in the console.
 */
function loadScript(src: string, onError?: () => void): void {
  const tag = document.createElement('script');
  tag.src = src;
  if (onError) tag.addEventListener('error', onError, { once: true });
  document.head.appendChild(tag);
}

/**
 * The embed URL for a trailer, built here rather than by the API.
 *
 * We render the iframe ourselves (see `VideoPlayer.vue`) so that YouTube
 * attaches to it instead of building its own — the one it builds carries an
 * `allow` attribute naming features no browser recognises in full, which is
 * fifteen console warnings per player in Firefox and one in Chrome. The API
 * only takes that path for an element that is already an iframe, and on it the
 * API neither builds the URL nor reads `playerVars`, so the parameters live
 * here. `enablejsapi` is what makes the embed accept commands at all, and the
 * host in this URL is what the API's postMessage handshake targets.
 */
export function embedUrl(videoId: string): string {
  const params = new URLSearchParams({
    controls: '0',
    rel: '0',
    // Always 1, even for the cards either side of the active one. An embed
    // built with autoplay 0 loads its chrome and poster but buffers no video,
    // so a windowed neighbour that had finished loading still started from cold
    // on the swipe onto it. Autoplaying it buffers and paints a real first
    // frame; the player's onReady pauses it again if it is not the active card.
    autoplay: '1',
    // Muted throughout: this is what makes the autoplay above permitted without
    // a user gesture. The real setting is applied once the embed is ready.
    mute: '1',
    // Without this, iOS Safari takes a trailer fullscreen on play and the swipe
    // feed stops being a feed.
    playsinline: '1',
    // The page's real origin, which is what the embed checks postMessage
    // against. Not an env var: this has to be what the browser is actually
    // showing, which only the runtime knows.
    origin: window.location.origin,
    enablejsapi: '1',
  });

  return `${EMBED_HOST}/embed/${videoId}?${params}`;
}
