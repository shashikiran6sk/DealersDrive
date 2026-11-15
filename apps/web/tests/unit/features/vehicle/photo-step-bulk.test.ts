import { STANDARD_PHOTO_SLOTS, type VehiclePhotoSlot } from '@dealers-drive/contracts';
import { describe, expect, it } from 'vitest';

import {
  EMPTY_ARRANGEMENT,
  arrange,
  exifCaptureTime,
  inCaptureOrder,
  stillMissing,
  swap,
  uploadQueue,
  without,
  type LocalPhoto,
} from '@/features/vehicle/photo-step';

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

function local(id: string): LocalPhoto {
  return {
    id,
    file: new File(['x'], `${id}.jpg`, { type: 'image/jpeg' }),
    previewUrl: `blob:${id}`,
  };
}

const none = new Set<VehiclePhotoSlot>();

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

describe('arranging photos into the ten shots', () => {
  it('fills the shots in order, then extras, and leaves out what does not fit', () => {
    const photos = Array.from({ length: 13 }, (_, index) => local(`p${String(index + 1)}`));
    const { arrangement, leftOut } = arrange(EMPTY_ARRANGEMENT, photos, none, 2);
    expect(arrangement.slots.map((photo) => photo?.id)).toEqual(
      photos.slice(0, 10).map((photo) => photo.id),
    );
    expect(arrangement.extras.map((photo) => photo.id)).toEqual(['p11', 'p12']);
    expect(leftOut.map((photo) => photo.id)).toEqual(['p13']);
  });

  it('skips shots that are already uploaded and keeps what was arranged before', () => {
    const uploaded = new Set<VehiclePhotoSlot>(['FRONT_THREE_QUARTER_RIGHT', 'REAR']);
    const first = arrange(EMPTY_ARRANGEMENT, [local('a')], uploaded, 0).arrangement;
    const { arrangement } = arrange(first, [local('b'), local('c'), local('d')], uploaded, 0);
    expect(arrangement.slots.slice(0, 6).map((photo) => photo?.id ?? null)).toEqual([
      null,
      'a',
      'b',
      'c',
      null,
      'd',
    ]);
    expect(stillMissing(arrangement, uploaded)).toEqual(STANDARD_PHOTO_SLOTS.slice(6));
  });

  it('swaps two shots, moves a photo into an empty one and between shots and extras', () => {
    const start = arrange(EMPTY_ARRANGEMENT, [local('a'), local('b'), local('x')], none, 3);
    const swapped = swap(start.arrangement, { area: 'slot', index: 0 }, { area: 'slot', index: 1 });
    expect(swapped.slots.slice(0, 3).map((photo) => photo?.id)).toEqual(['b', 'a', 'x']);

    const moved = swap(swapped, { area: 'slot', index: 2 }, { area: 'slot', index: 9 });
    expect(moved.slots[2]).toBeNull();
    expect(moved.slots[9]?.id).toBe('x');

    const toExtra = swap(moved, { area: 'slot', index: 9 }, { area: 'extra', index: 0 });
    expect(toExtra.slots[9]).toBeNull();
    expect(toExtra.extras.map((photo) => photo.id)).toEqual(['x']);

    const back = swap(toExtra, { area: 'extra', index: 0 }, { area: 'slot', index: 4 });
    expect(back.extras).toEqual([]);
    expect(back.slots[4]?.id).toBe('x');
  });

  it('queues the shots in order and then the extras, and forgets a removed photo', () => {
    const { arrangement } = arrange(
      EMPTY_ARRANGEMENT,
      [local('a'), local('b')],
      new Set<VehiclePhotoSlot>(STANDARD_PHOTO_SLOTS.slice(1)),
      2,
    );
    expect(uploadQueue(arrangement).map((item) => [item.slot, item.photo.id])).toEqual([
      ['FRONT_THREE_QUARTER_RIGHT', 'a'],
      ['EXTRA', 'b'],
    ]);
    expect(uploadQueue(without(arrangement, 'a')).map((item) => item.photo.id)).toEqual(['b']);
  });
});
