/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly TMDB_API_KEY: string;
  readonly APP_NAME: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare global {
  interface Window {
    onYouTubeIframeAPIReady: () => void;
  }
}

declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean;
    guestOnly?: boolean;
    hideLayout?: boolean;
    requiresOnboarding?: boolean;
    title?: string;
  }
}

export {};
