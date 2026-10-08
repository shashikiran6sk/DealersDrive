import type { PrismaClient } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';

import { createVehicleDerivativeWorker } from '../../../../src/modules/media/media.derivatives.js';
import type { StoragePort } from '../../../../src/platform/storage/storage.port.js';

describe('removed vehicle derivative cleanup', () => {
  it('deletes only worker-owned keys and clears successful orphan metadata', async () => {
    const remove = vi.fn(async () => undefined);
    const update = vi.fn(async () => ({ count: 1 }));
    const prisma = {
      media: {
        findMany: vi.fn(async (args: { where: { status: string } }) =>
          args.where.status === 'ORPHAN'
            ? [
                {
                  id: 'media',
                  variants: {
                    '640': 'vehicles/derivatives/media/640.webp',
                    private: 'private/kyc.pdf',
                  },
                },
                { id: 'invalid', variants: null },
              ]
            : [],
        ),
        updateMany: update,
      },
    } as unknown as PrismaClient;
    await createVehicleDerivativeWorker(prisma, { delete: remove } as unknown as StoragePort)();
    expect(remove).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledWith('vehicles/derivatives/media/640.webp');
    expect(update).toHaveBeenCalledWith({
      where: { id: 'media', status: 'ORPHAN' },
      data: { variants: {} },
    });
    remove.mockRejectedValue(new Error('storage down'));
    update.mockClear();
    await createVehicleDerivativeWorker(prisma, { delete: remove } as unknown as StoragePort)();
    expect(update).not.toHaveBeenCalled();
  });
});
