import { describe, expect, it } from 'vitest';
import { FILE_RULES } from '@cinemates/shared';
import { fileUrl, validateFile } from './files';

function makeFile(size: number, type: string): File {
  // A real Blob of `size` bytes would be wasteful at the 5 MB boundary, and
  // `File.size` is what the check reads, so define it directly.
  const file = new File([], 'photo.png', { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
}

describe('fileUrl', () => {
  it('builds the authenticated backend path from an id', () => {
    expect(fileUrl(42)).toMatch(/\/v1\/files\/42$/);
  });

  it('is undefined for a missing id, so no empty src is rendered', () => {
    expect(fileUrl(null)).toBeUndefined();
    expect(fileUrl(undefined)).toBeUndefined();
  });

  it('does not treat id 0 as absent', () => {
    expect(fileUrl(0)).toMatch(/\/files\/0$/);
  });
});

describe('validateFile', () => {
  const { maxBytes } = FILE_RULES.avatar;

  it('accepts every allowed mime', () => {
    for (const mime of FILE_RULES.avatar.mimes) {
      expect(validateFile(makeFile(1024, mime), 'avatar')).toBeNull();
    }
  });

  it('accepts a file exactly at the size limit', () => {
    expect(validateFile(makeFile(maxBytes, 'image/png'), 'avatar')).toBeNull();
  });

  it('rejects a file one byte over the limit', () => {
    expect(validateFile(makeFile(maxBytes + 1, 'image/png'), 'avatar')).toContain('too large');
  });

  it('rejects a zero-byte file', () => {
    expect(validateFile(makeFile(0, 'image/png'), 'avatar')).toContain('empty');
  });

  it('rejects a disallowed type', () => {
    expect(validateFile(makeFile(1024, 'image/svg+xml'), 'avatar')).toContain('Unsupported');
    expect(validateFile(makeFile(1024, 'application/pdf'), 'avatar')).toContain('Unsupported');
  });

  it('rejects a file with no declared type', () => {
    expect(validateFile(makeFile(1024, ''), 'avatar')).toContain('Unsupported');
  });
});
