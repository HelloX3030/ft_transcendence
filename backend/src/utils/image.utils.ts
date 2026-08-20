/**
 * Server-side image type detection. `mimetype` and `originalname` are
 * client-controlled, so the stored type comes from sniffing the leading bytes.
 * That keeps the served `Content-Type` honest and scriptable formats out of the
 * store. Accepted types: `FILE_RULES` in `shared/`.
 */

export interface DetectedImage {
  /** Canonical mimetype, safe to send as the response `Content-Type`. */
  mime: string;
  /** Extension (with leading dot) matching `mime`. */
  ext: string;
}

export const ALLOWED_IMAGE_LABEL = 'PNG, JPEG or WebP';

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG_MAGIC = Buffer.from([0xff, 0xd8, 0xff]);
const RIFF_MAGIC = Buffer.from('RIFF', 'ascii');
const WEBP_MAGIC = Buffer.from('WEBP', 'ascii');

/**
 * Returns the canonical type of `buffer` based on its magic bytes, or `null` if it is
 * not one of the allowed raster formats. Deliberately excludes SVG (scriptable) and
 * every other markup-ish format.
 */
export function detectImageType(buffer: Buffer): DetectedImage | null {
  if (buffer.subarray(0, PNG_MAGIC.length).equals(PNG_MAGIC)) {
    return { mime: 'image/png', ext: '.png' };
  }
  if (buffer.subarray(0, JPEG_MAGIC.length).equals(JPEG_MAGIC)) {
    return { mime: 'image/jpeg', ext: '.jpg' };
  }
  // WebP is a RIFF container: "RIFF" <4-byte size> "WEBP".
  if (buffer.subarray(0, 4).equals(RIFF_MAGIC) && buffer.subarray(8, 12).equals(WEBP_MAGIC)) {
    return { mime: 'image/webp', ext: '.webp' };
  }
  return null;
}
