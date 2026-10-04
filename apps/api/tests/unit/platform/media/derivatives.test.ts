import sharp from 'sharp';
import { describe, expect, it, vi } from 'vitest';

import { writeDerivatives } from '../../../../src/platform/media/derivatives.js';
import type { StoragePort } from '../../../../src/platform/storage/storage.port.js';
import { JPEG } from '../../../image-fixture.js';

describe('responsive derivatives', () => {
  it('writes four real WebP images with exact widths and content-keyed paths', async () => {
    const put = vi.fn().mockResolvedValue(undefined);
    const storage = { put } as unknown as StoragePort;
    const variants = await writeDerivatives('photo', JPEG, storage);
    expect(Object.keys(variants)).toEqual(['320', '640', '1024', '1600']);
    for (const [key, body, contentType] of put.mock.calls as [string, Buffer, string][]) {
      const info = await sharp(body).metadata();
      expect(info.format).toBe('webp');
      expect(info.width).toBe(Number(key.split('/').at(-1)?.split('.')[0]));
      expect(info.exif).toBeUndefined();
      expect(key).toMatch(/^derivatives\/photo\/[a-f0-9]{64}\/\d+\.webp$/);
      expect(contentType).toBe('image/webp');
    }
    expect(await writeDerivatives('photo', JPEG, storage)).toEqual(variants);
  });
  it('rejects corrupt signature-only data before storing anything and recovers for the next job', async () => {
    const put = vi.fn();
    const storage = { put } as unknown as StoragePort;
    await expect(
      writeDerivatives('bad', Buffer.from([0xff, 0xd8, 0xff]), storage),
    ).rejects.toMatchObject({ code: 'UPLOAD_NOT_IMAGE' });
    expect(put).not.toHaveBeenCalled();
    await expect(writeDerivatives('valid', JPEG, storage)).resolves.toHaveProperty('320');
  });
});
