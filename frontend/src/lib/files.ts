import { FILE_RULES, type FileKind } from '@trailertinder/shared';
import { API_BASE } from '@/api/http';

/**
 * Builds the URL for a stored file. Backend records carry an id, never a storage
 * URL — the bucket is private, so every read goes through the authenticated
 * `GET /files/:id`.
 *
 * `undefined` rather than `null` so it drops straight into `<img :src>` without
 * rendering an empty `src`.
 */
export function fileUrl(fileId: number): string;
export function fileUrl(fileId: number | null | undefined): string | undefined;
export function fileUrl(fileId: number | null | undefined): string | undefined {
  return fileId === null || fileId === undefined ? undefined : `${API_BASE}/files/${fileId}`;
}

/**
 * Checks a picked file against the same rules the server enforces.
 *
 * This is **UX only, never security**: it exists so a 12 MB photo fails in 5 ms
 * instead of after a 30-second upload. The server's magic-byte sniff stays
 * authoritative and is not relaxed — anyone can bypass this.
 *
 * Returns an error message, or `null` if the file passes.
 */
export function validateFile(file: File, kind: FileKind): string | null {
  const rules = FILE_RULES[kind];

  if (file.size === 0) return 'That file is empty.';
  if (file.size > rules.maxBytes) {
    return `That file is too large. Maximum size is ${formatBytes(rules.maxBytes)}.`;
  }
  if (!(rules.mimes as readonly string[]).includes(file.type)) {
    return `Unsupported format. Allowed: ${rules.mimes.map(shortMime).join(', ')}.`;
  }
  return null;
}

function shortMime(mime: string): string {
  return mime.replace('image/', '').toUpperCase();
}

function formatBytes(bytes: number): string {
  return `${Math.round(bytes / (1024 * 1024))} MB`;
}
