/**
 * Upload limits, shared so the client and the server cannot drift. The client
 * check is UX only; the server's magic-byte sniff stays authoritative.
 */

export const FILE_RULES = {
  avatar: {
    mimes: ["image/png", "image/jpeg", "image/webp"] as const,
    maxBytes: 5 * 1024 * 1024,
  },
} as const;

export type FileKind = keyof typeof FILE_RULES;
