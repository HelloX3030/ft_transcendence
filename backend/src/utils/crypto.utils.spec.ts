import { InternalServerErrorException } from '@nestjs/common';
import * as crypto from 'crypto';
import { CRYPTO_FORMAT, decryptSecret, encryptSecret } from './crypto.utils';

// 64 hex chars = the 32-byte AES-256 key the schema now enforces at boot.
const TEST_KEY = 'a3f1c9d4b2e8f0c1d3a4b5c6e7f8091a2b3c4d5e6f7081920a1b2c3d4e5f6071';
const PLAINTEXT = 'JBSWY3DPEHPK3PXP';

describe('crypto.utils', () => {
  const originalKey = process.env.MFA_KEY;

  beforeEach(() => {
    process.env.MFA_KEY = TEST_KEY;
  });

  afterAll(() => {
    if (originalKey === undefined) delete process.env.MFA_KEY;
    else process.env.MFA_KEY = originalKey;
  });

  describe('encryptSecret / decryptSecret', () => {
    it('round-trips a secret', () => {
      expect(decryptSecret(encryptSecret(PLAINTEXT))).toBe(PLAINTEXT);
    });

    it('emits the stored `<iv-hex>:<tag-hex>:<ciphertext-hex>` format', () => {
      const [ivHex, authTagHex, ciphertext, ...rest] = encryptSecret(PLAINTEXT).split(':');

      expect(rest).toHaveLength(0);
      expect(ivHex).toMatch(new RegExp(`^[0-9a-f]{${CRYPTO_FORMAT.IV_BYTES * 2}}$`));
      expect(authTagHex).toMatch(new RegExp(`^[0-9a-f]{${CRYPTO_FORMAT.AUTH_TAG_BYTES * 2}}$`));
      expect(ciphertext).toMatch(/^[0-9a-f]+$/);
    });

    it('uses a fresh IV per call, so the same input never yields the same ciphertext', () => {
      const a = encryptSecret(PLAINTEXT);
      const b = encryptSecret(PLAINTEXT);

      expect(a).not.toBe(b);
      expect(decryptSecret(a)).toBe(decryptSecret(b));
    });

    it('never leaks the plaintext into the stored value', () => {
      expect(encryptSecret(PLAINTEXT)).not.toContain(PLAINTEXT);
    });
  });

  // Rows written before the switch to GCM are still in the database and must
  // stay readable — this reproduces exactly how they were built.
  describe('backwards compatibility with CBC-era stored secrets', () => {
    function legacyEncrypt(text: string): string {
      const iv = crypto.randomBytes(CRYPTO_FORMAT.LEGACY_IV_BYTES);
      const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(TEST_KEY, 'hex'), iv);
      let encrypted = cipher.update(text, 'utf-8', 'hex');
      encrypted += cipher.final('hex');
      return iv.toString('hex') + ':' + encrypted;
    }

    it('decrypts a two-part value written under the old CBC scheme', () => {
      expect(decryptSecret(legacyEncrypt(PLAINTEXT))).toBe(PLAINTEXT);
    });

    it('re-encrypting a legacy value produces the authenticated format', () => {
      const upgraded = encryptSecret(decryptSecret(legacyEncrypt(PLAINTEXT)));

      expect(upgraded.split(':')).toHaveLength(3);
      expect(decryptSecret(upgraded)).toBe(PLAINTEXT);
    });
  });

  // The whole point of moving off CBC: a modified ciphertext has to be caught
  // rather than silently decrypting to something else.
  describe('tamper detection', () => {
    function flipLastHexDigit(hex: string): string {
      const last = hex.slice(-1);
      return hex.slice(0, -1) + (last === '0' ? '1' : '0');
    }

    it('rejects a modified ciphertext', () => {
      const [iv, tag, ciphertext] = encryptSecret(PLAINTEXT).split(':');

      expect(() => decryptSecret(`${iv}:${tag}:${flipLastHexDigit(ciphertext!)}`)).toThrow();
    });

    it('rejects a modified auth tag', () => {
      const [iv, tag, ciphertext] = encryptSecret(PLAINTEXT).split(':');

      expect(() => decryptSecret(`${iv}:${flipLastHexDigit(tag!)}:${ciphertext}`)).toThrow();
    });

    it('rejects a modified IV', () => {
      const [iv, tag, ciphertext] = encryptSecret(PLAINTEXT).split(':');

      expect(() => decryptSecret(`${flipLastHexDigit(iv!)}:${tag}:${ciphertext}`)).toThrow();
    });
  });

  describe('failure modes', () => {
    it('rejects a stored value with no IV separator', () => {
      expect(() => decryptSecret('deadbeef')).toThrow(InternalServerErrorException);
    });

    it('rejects a stored value with too many segments', () => {
      expect(() => decryptSecret('aa:bb:cc:dd')).toThrow(InternalServerErrorException);
    });

    it('throws when MFA_KEY is missing', () => {
      delete process.env.MFA_KEY;

      expect(() => encryptSecret(PLAINTEXT)).toThrow(InternalServerErrorException);
    });

    it('throws when MFA_KEY is not 32 bytes', () => {
      process.env.MFA_KEY = 'tooshort';

      expect(() => encryptSecret(PLAINTEXT)).toThrow(InternalServerErrorException);
    });

    it('cannot decrypt a secret encrypted under a different key', () => {
      const stored = encryptSecret(PLAINTEXT);
      process.env.MFA_KEY = 'b'.repeat(64);

      expect(() => decryptSecret(stored)).toThrow();
    });
  });
});
