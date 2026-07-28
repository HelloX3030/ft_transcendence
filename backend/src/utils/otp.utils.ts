import * as OTPAuth from 'otpauth';
import { decryptSecret } from './crypto.utils';

export function verifyTOTP(totpSecret: string, otp: string) {
  const secret = decryptSecret(totpSecret);
  const totp = new OTPAuth.TOTP({
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: secret,
  });

  // window: 1 also accepts the adjacent steps (±30s). Without it a code read
  // near a period boundary, or any client clock drift, reads as "invalid code".
  // validate() returns the delta, or null when nothing in the window matches.
  return totp.validate({ token: otp, window: 1 }) !== null;
}
