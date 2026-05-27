/// <reference types="vite/client" />

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
