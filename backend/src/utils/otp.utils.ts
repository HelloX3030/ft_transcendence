import { verify } from 'otplib';
import { decrypt, getMfaKey } from './crypto.utils';

export async function verifyTOTP(totpSecret: string, otp: string) {
  const key = getMfaKey();
  const [ivHex, encryptedSecret] = totpSecret.split(':');

  let iv = Buffer.from(ivHex, 'hex');

  const secret = decrypt(encryptedSecret, key, iv);

  const isValid = (await verify({ secret, token: otp })).valid;
  return isValid;
}
