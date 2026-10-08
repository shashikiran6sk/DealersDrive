import type { PrismaClient } from '@prisma/client';
import sharp from 'sharp';
import { describe, expect, it, vi } from 'vitest';

import { createVehicleDerivativeWorker } from '../../../../src/modules/media/media.derivatives.js';
import type { StoragePort } from '../../../../src/platform/storage/storage.port.js';

async function fixture() {
  const png = await sharp({ create: { width: 48, height: 32, channels: 3, background: '#155e75' } })
    .png()
    .toBuffer();
  const row = {
    id: 'synthetic-media',
    storageKey: 'vehicles/synthetic/original.png',
    bytes: png.length,
    mimeType: 'image/png',
  };
  const update = vi.fn(async () => ({ count: 1 }));
  const put = vi.fn<StoragePort['put']>(async () => undefined);
  const get = vi.fn<StoragePort['get']>(async () => png);
  const prisma = {
    media: {
      findMany: vi.fn(async (args: { where: { status: string } }) =>
        args.where.status === 'ORPHAN' ? [] : [row],
      ),
      updateMany: update,
    },
  } as unknown as PrismaClient;
  const storage = { get, put } as unknown as StoragePort;
  return { run: createVehicleDerivativeWorker(prisma, storage), update, put, get, prisma };
}
describe('approved vehicle media derivative worker', () => {
  it('creates bounded metadata-free WebP sizes without duplicating inventory or changing approval', async () => {
    const h = await fixture();
    await h.run();
    expect(h.put).toHaveBeenCalledTimes(4);
    for (const [_key, bytes, type] of h.put.mock.calls) {
      const metadata = await sharp(bytes).metadata();
      expect(type).toBe('image/webp');
      expect(metadata.exif).toBeUndefined();
      expect(metadata.width).toBe(48);
    }
    expect(h.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'synthetic-media', status: 'READY', variants: { equals: {} } },
        data: expect.objectContaining({
          variants: expect.objectContaining({
            '640': 'vehicles/derivatives/synthetic-media/640.webp',
          }),
        }),
      }),
    );
    expect(h.prisma.media.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 100,
        where: expect.objectContaining({ ownerType: 'VEHICLE', uploadedByAdmin: true }),
      }),
    );
  });
  it('retains original state on unavailable/corrupt/oversized storage input for safe retry', async () => {
    for (const body of [null, Buffer.from('not an image'), Buffer.alloc(13 * 1024 * 1024)]) {
      const h = await fixture();
      h.get.mockResolvedValue(body);
      await h.run();
      expect(h.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { derivativesRetryAt: expect.any(Date) } }),
      );
    }
    const h = await fixture();
    h.put.mockRejectedValue(new Error('storage unavailable'));
    await h.run();
    expect(h.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { derivativesRetryAt: expect.any(Date) } }),
    );
  });
});
