import type { PrismaClient } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';

import { createStorefrontMediaCleanup } from '../../../../src/modules/storefront/storefront.media-cleanup.js';
import type { StoragePort } from '../../../../src/platform/storage/storage.port.js';

function harness(
  options: {
    referenced?: boolean;
    missing?: boolean;
    badPrefix?: boolean;
    badVariants?: boolean;
    failedDelete?: boolean;
  } = {},
) {
  const candidate = { id: 'media', dealerId: 'dealer' };
  const media = {
    id: 'media',
    storageKey: options.badPrefix ? 'private/kyc.pdf' : 'storefront/dealer/media/original.png',
    variants: options.badVariants
      ? null
      : { '640': 'storefront/dealer/media/640.webp', unsafe: 'private/other-dealer.pdf' },
  };
  const remove = vi.fn(async () => {
    if (options.failedDelete) throw new Error('Storage unavailable');
  });
  const tx = {
    $executeRaw: vi.fn(async () => 1),
    media: {
      findUnique: vi.fn(async () => (options.missing ? null : media)),
      update: vi.fn(async () => ({})),
    },
    dealerStorefront: { count: vi.fn(async () => (options.referenced ? 1 : 0)) },
  };
  const prisma = {
    $queryRaw: vi.fn(async () => [candidate, { id: 'no-dealer', dealerId: null }]),
    $transaction: vi.fn(async (work: (tx: unknown) => Promise<unknown>) => work(tx)),
    media: { deleteMany: vi.fn(async () => ({ count: 1 })) },
  } as unknown as PrismaClient;
  return {
    cleanup: createStorefrontMediaCleanup(prisma, { delete: remove } as unknown as StoragePort),
    remove,
    tx,
    prisma,
  };
}
describe('branding orphan cleanup', () => {
  it('pins deletion to a verified owned prefix and removes successful orphan rows', async () => {
    const h = harness();
    await h.cleanup();
    expect(h.remove).toHaveBeenCalledWith('storefront/dealer/media/original.png');
    expect(h.remove).not.toHaveBeenCalledWith('private/other-dealer.pdf');
    expect(h.prisma.media.deleteMany).toHaveBeenCalledWith({
      where: { id: 'media', status: 'ORPHAN' },
    });
  });
  it.each([{ referenced: true }, { missing: true }, { badPrefix: true }])(
    'retains referenced/missing/unowned assets %#',
    async (options) => {
      const h = harness(options);
      await h.cleanup();
      expect(h.remove).not.toHaveBeenCalled();
    },
  );
  it('retains failed removal for retry and handles malformed variant metadata safely', async () => {
    const h = harness({ failedDelete: true });
    await h.cleanup();
    expect(h.prisma.media.deleteMany).not.toHaveBeenCalled();
    const malformed = harness({ badVariants: true });
    await malformed.cleanup();
    expect(malformed.remove).toHaveBeenCalledWith('storefront/dealer/media/1600.webp');
  });
});
