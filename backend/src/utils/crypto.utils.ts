import { InternalServerErrorException, Logger } from '@nestjs/common';
import * as crypto from 'crypto';

const algorithm = 'aes-256-cbc';

// Standalone functions, so there is no injected logger to reach for.
const logger = new Logger('CryptoUtils');

export function getMfaKey() {
  const key = process.env.MFA_KEY;
  if (key === undefined || key.length !== 64) {
    logger.error('The env "MFA_KEY" is not set or is not 32-bytes long.');
    throw new InternalServerErrorException();
  }
  return Buffer.from(key, 'hex');
}

export function encrypt(text: string, key: Buffer<ArrayBuffer>, iv: Buffer<ArrayBuffer>): string {
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  let encrypted = cipher.update(text, 'utf-8', 'hex');
  encrypted += cipher.final('hex');
  return encrypted;
}

export function decrypt(
  encryptedText: string,
  key: Buffer<ArrayBuffer>,
  iv: Buffer<ArrayBuffer>,
): string {
  const decipher = crypto.createDecipheriv(algorithm, key, iv);
  let decrypted = decipher.update(encryptedText, 'hex', 'utf-8');
  decrypted += decipher.final('utf-8');
  return decrypted;
}
