import { InternalServerErrorException } from '@nestjs/common';
import * as crypto from 'crypto';

const algorithm = 'aes-256-cbc';

export function getMfaKey() {
  const key = process.env.MFA_KEY;
  if (key === undefined) {
    console.error('The env "MFA_KEY" is not set.');
    throw new InternalServerErrorException();
  }
  return key;
}

export function encrypt(text: string, key: string, iv: Buffer<ArrayBuffer>): string {
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  let encrypted = cipher.update(text, 'utf-8', 'hex');
  encrypted += cipher.final('hex');
  return encrypted;
}

export function decrypt(encryptedText: string, key: string, iv: Buffer<ArrayBuffer>): string {
  const decipher = crypto.createDecipheriv(algorithm, key, iv);
  let decrypted = decipher.update(encryptedText, 'hex', 'utf-8');
  decrypted += decipher.final('utf-8');
  return decrypted;
}
