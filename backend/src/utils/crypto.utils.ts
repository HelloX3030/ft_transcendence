import { InternalServerErrorException, Logger } from '@nestjs/common';
import * as crypto from 'crypto';

const algorithm = 'aes-256-cbc';
const IV_BYTES = 16;

// Standalone functions, so there is no injected logger to reach for.
const logger = new Logger('CryptoUtils');

function getMfaKey() {
  const key = process.env.MFA_KEY;
  if (key === undefined || key.length !== 64) {
    logger.error('The env "MFA_KEY" is not set or is not 32-bytes long.');
    throw new InternalServerErrorException();
  }
  return Buffer.from(key, 'hex');
}

function encrypt(text: string, key: Buffer<ArrayBuffer>, iv: Buffer<ArrayBuffer>): string {
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  let encrypted = cipher.update(text, 'utf-8', 'hex');
  encrypted += cipher.final('hex');
  return encrypted;
}

function decrypt(encryptedText: string, key: Buffer<ArrayBuffer>, iv: Buffer<ArrayBuffer>): string {
  const decipher = crypto.createDecipheriv(algorithm, key, iv);
  let decrypted = decipher.update(encryptedText, 'hex', 'utf-8');
  decrypted += decipher.final('utf-8');
  return decrypted;
}

// Secrets are persisted as `<iv-hex>:<ciphertext-hex>`. Both halves of that
// format live here and nowhere else, so changing the cipher (or moving the IV)
// is a change to this file alone.
export function encryptSecret(plaintext: string): string {
  const iv = crypto.randomBytes(IV_BYTES);
  return `${iv.toString('hex')}:${encrypt(plaintext, getMfaKey(), iv)}`;
}

export function decryptSecret(stored: string): string {
  const [ivHex, ciphertext] = stored.split(':');
  if (ivHex === undefined || ciphertext === undefined) {
    logger.error('Stored secret is not in the expected "iv:ciphertext" format.');
    throw new InternalServerErrorException();
  }
  return decrypt(ciphertext, getMfaKey(), Buffer.from(ivHex, 'hex'));
}
