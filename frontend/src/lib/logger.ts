/**
 * The one place the app writes to the console, with no environment gate.
 * `debug` is for anything routine, including a failure the UI already shows.
 * `error` is for a genuine fault with no user-facing outlet, so an error in the
 * console always means a real defect. There is deliberately no `warn`.
 */
/* eslint-disable no-console -- this module is the sanctioned exception. */
export const logger = {
  debug(...args: unknown[]) {
    console.debug(...args);
  },
  error(...args: unknown[]) {
    console.error(...args);
  },
};
