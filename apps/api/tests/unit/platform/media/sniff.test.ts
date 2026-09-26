import { describe, expect, it } from 'vitest';

import { sniffImageType } from '../../../../src/platform/media/sniff.js';

describe('sniffImageType', () => {
  it('reads a JPEG, a PNG and a WebP by their first bytes', () => {
    expect(sniffImageType(Buffer.from([0xff, 0xd8, 0xff, 0xdb, 0x00]))).toBe('image/jpeg');
    expect(
      sniffImageType(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00])),
    ).toBe('image/png');
    expect(sniffImageType(Buffer.from('RIFF\x10\x00\x00\x00WEBPVP8 ', 'binary'))).toBe(
      'image/webp',
    );
  });

  it('knows nothing else, whatever it is called', () => {
    expect(sniffImageType(Buffer.from('GIF89a'))).toBeNull();
    expect(sniffImageType(Buffer.from('%PDF-1.7'))).toBeNull();
    expect(sniffImageType(Buffer.from('RIFF\x10\x00\x00\x00WAVE', 'binary'))).toBeNull();
    expect(sniffImageType(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'))).toBeNull();
  });

  it('refuses a file too short to carry a signature', () => {
    expect(sniffImageType(Buffer.alloc(0))).toBeNull();
    expect(sniffImageType(Buffer.from([0xff, 0xd8]))).toBeNull();
    expect(sniffImageType(Buffer.from('RIFF'))).toBeNull();
  });
});
