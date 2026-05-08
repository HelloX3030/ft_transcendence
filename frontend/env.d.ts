/// <reference types="vite/client" />

declare global {
  interface Window {
    onYouTubeIframeAPIReady: () => void;
  }
}

export {};
