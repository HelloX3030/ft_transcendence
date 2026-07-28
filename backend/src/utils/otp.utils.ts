import * as OTPAuth from 'otpauth';
import { decryptSecret } from './crypto.utils';

const PERIOD_SECONDS = 30;

/**
 * Checks `otp` against the stored secret and returns the absolute time step it
 * belongs to, or `null` if it matches nothing in the acceptance window.
 *
 * Callers need the counter, not just a yes/no: the ±1 window means a code stays
 * valid for about 90 seconds, and persisting the counter is what stops the same
 * code being replayed within that time (see `users.totpLastCounter`).
 */
export function verifyTOTP(totpSecret: string, otp: string): number | null {
  const secret = decryptSecret(totpSecret);
  const totp = new OTPAuth.TOTP({
    algorithm: 'SHA1',
    digits: 6,
    period: PERIOD_SECONDS,
    secret: secret,
  });

  // window: 1 also accepts the adjacent steps. Without it a code read near a
  // period boundary, or any client clock drift, reads as "invalid code".
  // validate() returns the delta from the current step, or null for no match.
  const delta = totp.validate({ token: otp, window: 1 });
  if (delta === null) return null;

  return currentStep() + delta;
}

/** The time step `Date.now()` falls in, matching what otpauth counts from. */
function currentStep(): number {
  return Math.floor(Date.now() / 1000 / PERIOD_SECONDS);
}
