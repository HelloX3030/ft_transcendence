import { InternalServerErrorException, Logger } from '@nestjs/common';
import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
/** 96 bits, the size GCM is specified around. */
const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;

/**
 * Superseded by GCM. Only ever used for reading: rows written before the switch
 * are still out there, and CBC cannot detect a tampered ciphertext.
 */
const LEGACY_ALGORITHM = 'aes-256-cbc';
const LEGACY_IV_BYTES = 16;

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

/**
 * Secrets are persisted as `<iv>:<auth-tag>:<ciphertext>`, all hex.
 *
 * The auth tag is what makes this different from the CBC scheme it replaced:
 * decryption fails loudly if the stored value was altered, rather than handing
 * back plausible-looking garbage. Values in the older two-part `<iv>:<ciphertext>`
 * form are still readable — see decryptSecret — and are rewritten in this format
 * the next time the user sets TOTP up.
 */
export function encryptSecret(plaintext: string): string {
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, getMfaKey(), iv);

  let ciphertext = cipher.update(plaintext, 'utf-8', 'hex');
  ciphertext += cipher.final('hex');
  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${ciphertext}`;
}

export function decryptSecret(stored: string): string {
  const parts = stored.split(':');

  if (parts.length === 3) {
    const [ivHex, authTagHex, ciphertext] = parts;
    if (ivHex === undefined || authTagHex === undefined || ciphertext === undefined) {
      return rejectMalformed();
    }
    const decipher = crypto.createDecipheriv(ALGORITHM, getMfaKey(), Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));

    // final() throws if the tag does not match, i.e. if the row was tampered with.
    let plaintext = decipher.update(ciphertext, 'hex', 'utf-8');
    plaintext += decipher.final('utf-8');
    return plaintext;
  }

  if (parts.length === 2) {
    const [ivHex, ciphertext] = parts;
    if (ivHex === undefined || ciphertext === undefined) return rejectMalformed();
    return decryptLegacy(ivHex, ciphertext);
  }

  return rejectMalformed();
}

/** Reads a pre-GCM row. Unauthenticated, so it cannot detect tampering. */
function decryptLegacy(ivHex: string, ciphertext: string): string {
  const decipher = crypto.createDecipheriv(
    LEGACY_ALGORITHM,
    getMfaKey(),
    Buffer.from(ivHex, 'hex'),
  );
  let plaintext = decipher.update(ciphertext, 'hex', 'utf-8');
  plaintext += decipher.final('utf-8');
  return plaintext;
}

function rejectMalformed(): never {
  logger.error('Stored secret is not in a recognised "iv:tag:ciphertext" format.');
  throw new InternalServerErrorException();
}

/** Exported for tests that pin the on-disk format. */
export const CRYPTO_FORMAT = { IV_BYTES, AUTH_TAG_BYTES, LEGACY_IV_BYTES } as const;
