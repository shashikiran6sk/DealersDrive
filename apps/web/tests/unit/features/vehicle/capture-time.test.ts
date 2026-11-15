import { describe, expect, it } from 'vitest';

import { exifCaptureTime, inCaptureOrder } from '@/features/vehicle/photo-step';

function jpegWithExif(taken: string, subSeconds = '', little = true): ArrayBuffer {
  const entries = subSeconds ? 2 : 1;
  const exifIfd = 26;
  const dataAt = exifIfd + 2 + entries * 12 + 4;
  const tiffLength = dataAt + 20;
  const bytes = new Uint8Array(4 + 2 + 6 + tiffLength + 2);
  const view = new DataView(bytes.buffer);
  view.setUint16(0, 0xffd8);
  view.setUint16(2, 0xffe1);
  view.setUint16(4, 2 + 6 + tiffLength);
  'Exif'.split('').forEach((char, index) => view.setUint8(6 + index, char.charCodeAt(0)));
  const tiff = 12;
  view.setUint16(tiff, little ? 0x4949 : 0x4d4d);
  view.setUint16(tiff + 2, 42, little);
  view.setUint32(tiff + 4, 8, little);
  view.setUint16(tiff + 8, 1, little);
  view.setUint16(tiff + 10, 0x8769, little);
  view.setUint16(tiff + 12, 4, little);
  view.setUint32(tiff + 14, 1, little);
  view.setUint32(tiff + 18, exifIfd, little);
  view.setUint16(tiff + exifIfd, entries, little);
  const first = tiff + exifIfd + 2;
  view.setUint16(first, 0x9003, little);
  view.setUint16(first + 2, 2, little);
  view.setUint32(first + 4, 20, little);
  view.setUint32(first + 8, dataAt, little);
  if (subSeconds) {
    const second = first + 12;
    view.setUint16(second, 0x9291, little);
    view.setUint16(second + 2, 2, little);
    view.setUint32(second + 4, subSeconds.length + 1, little);
    subSeconds
      .split('')
      .forEach((char, index) => view.setUint8(second + 8 + index, char.charCodeAt(0)));
  }
  taken
    .split('')
    .forEach((char, index) => view.setUint8(tiff + dataAt + index, char.charCodeAt(0)));
  view.setUint16(bytes.length - 2, 0xffda);
  return bytes.buffer;
}

describe('reading when a photo was taken', () => {
  it('reads DateTimeOriginal from either byte order, with sub-seconds', () => {
    const base = Date.UTC(2026, 10, 15, 10, 30, 45);
    expect(exifCaptureTime(jpegWithExif('2026:11:15 10:30:45'))).toBe(base);
    expect(exifCaptureTime(jpegWithExif('2026:11:15 10:30:45', '', false))).toBe(base);
    expect(exifCaptureTime(jpegWithExif('2026:11:15 10:30:45', '25'))).toBe(base + 250);
  });

  it('answers nothing for a file that is not a JPEG with a capture date', () => {
    expect(exifCaptureTime(new Uint8Array([0x89, 0x50, 0x4e, 0x47]).buffer)).toBeNull();
    expect(exifCaptureTime(new Uint8Array([0xff, 0xd8, 0xff, 0xda, 0, 2]).buffer)).toBeNull();
    expect(exifCaptureTime(jpegWithExif('not a date at all!!'))).toBeNull();
    expect(exifCaptureTime(jpegWithExif('2026:11:15 10:30:45').slice(0, 30))).toBeNull();
  });

  it('orders by capture time, then by the time on the file, then by name', async () => {
    const late = new File([jpegWithExif('2026:11:15 10:31:00')], 'b.jpg', { type: 'image/jpeg' });
    const early = new File([jpegWithExif('2026:11:15 10:30:00')], 'z.jpg', { type: 'image/jpeg' });
    const ordered = await inCaptureOrder([late, early]);
    expect(ordered.map((file) => file.name)).toEqual(['z.jpg', 'b.jpg']);

    const same = 1_700_000_000_000;
    const files = ['IMG_10.png', 'IMG_9.png', 'IMG_2.png'].map(
      (name) => new File(['x'], name, { type: 'image/png', lastModified: same }),
    );
    expect((await inCaptureOrder(files)).map((file) => file.name)).toEqual([
      'IMG_2.png',
      'IMG_9.png',
      'IMG_10.png',
    ]);
  });
});
