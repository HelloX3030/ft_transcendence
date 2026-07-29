/**
 * Diagnostics that must not reach a user's console in production.
 *
 * `import.meta.env.DEV` is statically replaced by Vite, so the bodies below
 * collapse to nothing in a production build. Anything a user actually needs to
 * see belongs in the UI (a toast, an error state), not in here.
 */
export const logger = {
  debug(...args: unknown[]) {
    if (import.meta.env.DEV) console.debug(...args);
  },
  error(...args: unknown[]) {
    if (import.meta.env.DEV) console.error(...args);
  },
};
