/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_NAME: string;
  readonly VITE_BACKEND_URL: string;
  /**
   * Optional. "true" only when the server has Google credentials — a visible
   * button without them would 503 on click, so it stays hidden instead.
   */
  readonly VITE_GOOGLE_ENABLED?: string;
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
