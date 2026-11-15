import { crc32 } from 'node:zlib';

import { describe, expect, it } from 'vitest';

import { storedZip } from '../../../../src/platform/archive/zip.js';
import { readZip } from '../../../zip-reader.js';

describe('a stored zip', () => {
  it('holds every file byte for byte, named and checksummed, in order', () => {
    const files = [
      {
        name: '2016-hyundai-creta-01-front-three-quarter-driver-side.jpg',
        data: Buffer.from([0xff, 0xd8, 0xff, 1, 2, 3]),
      },
      { name: '2016-hyundai-creta-02-straight-front.jpg', data: Buffer.alloc(4096, 7) },
    ];
    const entries = readZip(storedZip(files));
    expect(entries.map((entry) => entry.name)).toEqual(files.map((file) => file.name));
    entries.forEach((entry, index) => {
      expect(entry.data.equals(files[index]?.data ?? Buffer.alloc(0))).toBe(true);
      expect(entry.crc).toBe(crc32(files[index]?.data ?? Buffer.alloc(0)) >>> 0);
    });
  });

  it('is a valid empty archive with nothing in it', () => {
    expect(readZip(storedZip([]))).toEqual([]);
  });
});
