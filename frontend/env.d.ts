/// <reference types="vite/client" />

declare global {
  interface Window {
    YT: {
      Player: new (
        elementId: string,
        options: {
          videoId?: string;
          playerVars?: {
            controls?: number;
            rel?: number;
            modestbranding?: number;
            autoplay?: number;
            mute?: number;
          };
          events?: {
            onReady?: (e: any) => void;
            onStateChange?: (e: any) => void;
          };
        },
      ) => any;
      PlayerState: {
        PLAYING: number;
        PAUSED: number;
        ENDED: number;
        BUFFERING: number;
      };
    };
    onYouTubeIframeAPIReady: () => void;
  }
}

export {};
