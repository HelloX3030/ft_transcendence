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

  return totp.generate() === otp;
}
