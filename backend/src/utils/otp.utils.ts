import * as OTPAuth from 'otpauth';
import { decrypt, getMfaKey } from './crypto.utils';

export function decryptTOTPSecret(totpSecret: string) {
  const key = getMfaKey();
  const [ivHex, encryptedSecret] = totpSecret.split(':');

  const iv = Buffer.from(ivHex, 'hex');

  const secret = decrypt(encryptedSecret, key, iv);
  return secret;
}

export function verifyTOTP(totpSecret: string, otp: string) {
  const secret = decryptTOTPSecret(totpSecret);
  const totp = new OTPAuth.TOTP({
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: secret,
  });

  if (totp.generate() === otp) return true;
  else return false;
}
