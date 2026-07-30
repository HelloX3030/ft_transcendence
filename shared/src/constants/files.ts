/**
 * Upload limits, shared so the client and the server cannot drift.
 *
 * The client check is UX only — it fails a 12 MB photo in 5 ms instead of after
 * a 30-second upload. The server's magic-byte sniff stays authoritative; anyone
 * can bypass the client.
 */

export const FILE_RULES = {
  avatar: {
    mimes: ["image/png", "image/jpeg", "image/webp"] as const,
    maxBytes: 5 * 1024 * 1024,
  },
} as const;

export type FileKind = keyof typeof FILE_RULES;
