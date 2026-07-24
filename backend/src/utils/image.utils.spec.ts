import { detectImageType } from './image.utils';

const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
const webp = Buffer.concat([
  Buffer.from('RIFF', 'ascii'),
  Buffer.from([0x00, 0x00, 0x00, 0x00]),
  Buffer.from('WEBP', 'ascii'),
]);

describe('detectImageType', () => {
  it.each([
    ['png', png, 'image/png', '.png'],
    ['jpeg', jpeg, 'image/jpeg', '.jpg'],
    ['webp', webp, 'image/webp', '.webp'],
  ])('detects %s', (_name, buffer, mime, ext) => {
    expect(detectImageType(buffer as Buffer)).toEqual({ mime, ext });
  });

  it('detects the format from the bytes even with extra trailing data', () => {
    expect(detectImageType(Buffer.concat([png, Buffer.from('payload')]))).toEqual({
      mime: 'image/png',
      ext: '.png',
    });
  });

  it.each([
    ['svg', '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'],
    ['svg with xml prolog', '<?xml version="1.0"?><svg><script/></svg>'],
    ['html', '<!doctype html><script>alert(1)</script>'],
    ['plain text', 'not an image'],
  ])('rejects %s', (_name, content) => {
    expect(detectImageType(Buffer.from(content))).toBeNull();
  });

  it('rejects an empty or truncated buffer', () => {
    expect(detectImageType(Buffer.alloc(0))).toBeNull();
    expect(detectImageType(png.subarray(0, 4))).toBeNull();
    expect(detectImageType(Buffer.from('RIFF', 'ascii'))).toBeNull();
  });

  it('rejects a RIFF container that is not WebP', () => {
    const wav = Buffer.concat([
      Buffer.from('RIFF', 'ascii'),
      Buffer.from([0x00, 0x00, 0x00, 0x00]),
      Buffer.from('WAVE', 'ascii'),
    ]);
    expect(detectImageType(wav)).toBeNull();
  });
});
