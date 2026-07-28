import { InternalServerErrorException } from '@nestjs/common';
import * as crypto from 'crypto';
import { decryptSecret, encryptSecret } from './crypto.utils';

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

    it('emits the stored `<iv-hex>:<ciphertext-hex>` format', () => {
      const [ivHex, ciphertext, ...rest] = encryptSecret(PLAINTEXT).split(':');

      expect(rest).toHaveLength(0);
      // 16-byte IV as hex.
      expect(ivHex).toMatch(/^[0-9a-f]{32}$/);
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

  // Rows written before the encode/decode moved into this module must still be
  // readable — this reproduces exactly how users.service used to build them.
  describe('backwards compatibility with pre-refactor stored secrets', () => {
    function legacyEncrypt(text: string): string {
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(TEST_KEY, 'hex'), iv);
      let encrypted = cipher.update(text, 'utf-8', 'hex');
      encrypted += cipher.final('hex');
      return iv.toString('hex') + ':' + encrypted;
    }

    it('decrypts a value produced by the old hand-rolled encoding', () => {
      expect(decryptSecret(legacyEncrypt(PLAINTEXT))).toBe(PLAINTEXT);
    });
  });

  describe('failure modes', () => {
    it('rejects a stored value with no IV separator', () => {
      expect(() => decryptSecret('deadbeef')).toThrow(InternalServerErrorException);
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
