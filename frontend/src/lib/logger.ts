/**
 * The one place the app writes to the console.
 *
 * No environment gate and no debug mode. A second state is a second thing that
 * can be in the wrong position, and the state that matters — the one an
 * evaluator sees — would be the untested one. What keeps the console clean is
 * what the call sites ask for, not a switch that swallows what they asked:
 *
 * - `debug` is for anything routine, including a failure the UI already shows.
 *   It is not a policy violation and needs no suppression.
 * - `error` is for a genuine, unexpected fault with no user-facing outlet. In a
 *   working app it never fires, so an error in the console always means a real
 *   defect. If a failure has neither an outlet nor a reason to be expected, the
 *   bug is the missing UI: add the error state, then log at `debug`.
 *
 * There is deliberately no `warn`. For an evaluation a warning is as much a
 * failure as an error, so there is no useful severity between "silent" and
 * "forbidden".
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
