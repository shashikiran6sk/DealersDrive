import type { PrismaClient } from '@prisma/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createMediaService, toMediaStatus } from '../../../../src/modules/media/media.service.js';
import type { StoragePort } from '../../../../src/platform/storage/storage.port.js';
import { logger } from '../../../../src/platform/telemetry/logger.js';
import { metricsRegistry } from '../../../../src/platform/telemetry/metrics.js';

/**
 * Unit tests for `src/modules/media/media.service.ts`.
 *
 * R45 withdrew the dealer's vehicle-photo routes (`/v1/dealer/media/*`): a
 * dealer never writes vehicle media, and the admin upload lives in the
 * `vehicle-images` module with its own tests. What is left here is delivery —
 * `serve()` — and the status mapper. Resizing (**F034**) is
 * `media.processor.ts`, tested in `media.processor.test.ts`.
 */
interface Row {
  id: string;
  dealerId: string;
  ownerType: string;
  storageKey: string;
  mimeType: string;
  status: string;
  variants: unknown;
  attachment: {
    vehicle: { listing: { status: string; dealer: { status: string } } | null };
  } | null;
}

function mediaRow(overrides: Partial<Row> = {}): Row {
  return {
    id: 'media-1',
    dealerId: 'dealer-1',
    ownerType: 'VEHICLE',
    storageKey: 'vehicles/vehicle-1/media-1/original.jpg',
    mimeType: 'image/jpeg',
    status: 'READY',
    variants: {},
    attachment: { vehicle: { listing: { status: 'ACTIVE', dealer: { status: 'ACTIVE' } } } },
    ...overrides,
  };
}

interface Fakes {
  media?: Partial<Row> | null;
  objectBody?: Buffer | null;
  approvedPortfolioRows?: number;
}

function setup(options: Fakes = {}) {
  const row = options.media === null ? null : mediaRow(options.media ?? {});

  const prisma = {
    media: { findUnique: () => Promise.resolve(row) },
    dealerPortfolioPhoto: { count: () => Promise.resolve(options.approvedPortfolioRows ?? 1) },
  } as unknown as PrismaClient;

  const storage = {
    get: () => Promise.resolve(options.objectBody ?? null),
  } as unknown as StoragePort;

  return { service: createMediaService({ prisma, storage }) };
}

describe('serve', () => {
  it('serves the requested width', async () => {
    const h = setup({
      objectBody: Buffer.from('webp-bytes'),
      media: { status: 'READY', variants: { '640': 'vehicles/v/m/640.webp' } },
    });

    const served = await h.service.serve('media-1', 640);

    expect(served?.contentType).toBe('image/webp');
    expect(served?.body.toString()).toBe('webp-bytes');
  });

  it('falls back down the ladder when the requested width was never written', async () => {
    const h = setup({
      objectBody: Buffer.from('x'),
      media: { status: 'READY', variants: { '1024': 'vehicles/v/m/1024.webp' } },
    });

    // Better a larger rendition than a broken image.
    await expect(h.service.serve('media-1', 1600)).resolves.toBeTruthy();
  });

  it('falls back to the original, reporting its own mime type', async () => {
    const h = setup({
      objectBody: Buffer.from('jpeg-bytes'),
      media: { status: 'READY', variants: {}, mimeType: 'image/jpeg' },
    });

    expect((await h.service.serve('media-1', 640))?.contentType).toBe('image/jpeg');
  });

  it('refuses to serve anything that is not READY', async () => {
    for (const status of ['PENDING', 'PROCESSING', 'FAILED', 'ORPHAN']) {
      const h = setup({ objectBody: Buffer.from('x'), media: { status } });

      expect(await h.service.serve('media-1', 640), status).toBeNull();
    }
  });

  it('returns null for a media row that does not exist', async () => {
    const h = setup({ media: null });

    expect(await h.service.serve('media-1', 640)).toBeNull();
  });

  it('returns null when the bytes have gone from storage', async () => {
    const h = setup({ media: { status: 'READY' }, objectBody: null });

    expect(await h.service.serve('media-1', 640)).toBeNull();
  });
});

describe('locate, when a derivative is missing', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function fallbacks(served: string): Promise<number> {
    const metric = await metricsRegistry
      .getSingleMetric('dealers_drive_media_variant_fallbacks_total')
      ?.get();
    return metric?.values.find((value) => value.labels.served === served)?.value ?? 0;
  }

  it('warns and counts when the original is served because nothing was resized', async () => {
    const warn = vi.spyOn(logger, 'warn');
    const before = await fallbacks('original');
    const h = setup({ media: { variants: {} } });

    expect((await h.service.locate('media-1', 640))?.key).toBe(
      'vehicles/vehicle-1/media-1/original.jpg',
    );

    expect(warn).toHaveBeenCalledWith(
      { mediaId: 'media-1', width: 640, served: 'original' },
      'media.variant_missing',
    );
    expect(await fallbacks('original')).toBe(before + 1);
  });

  it('warns when a derivative width was never written, even though a larger one is served', async () => {
    const warn = vi.spyOn(logger, 'warn');
    const before = await fallbacks('variant');
    const h = setup({ media: { variants: { '1024': 'vehicles/v/m/1024.webp' } } });

    expect((await h.service.locate('media-1', 640))?.key).toBe('vehicles/v/m/1024.webp');

    expect(warn).toHaveBeenCalledWith(
      { mediaId: 'media-1', width: 640, served: 'variant' },
      'media.variant_missing',
    );
    expect(await fallbacks('variant')).toBe(before + 1);
  });

  it('stays quiet for the width it has, and for an odd width a derivative answers', async () => {
    const warn = vi.spyOn(logger, 'warn');
    const h = setup({
      media: { variants: { '640': 'vehicles/v/m/640.webp', '1600': 'vehicles/v/m/1600.webp' } },
    });

    expect((await h.service.locate('media-1', 640))?.key).toBe('vehicles/v/m/640.webp');
    expect((await h.service.locate('media-1', 800))?.key).toBe('vehicles/v/m/1600.webp');
    expect(warn).not.toHaveBeenCalled();
  });

  it('says nothing about an image it refuses to serve', async () => {
    const warn = vi.spyOn(logger, 'warn');
    const h = setup({ media: { status: 'PENDING', variants: {} } });

    expect(await h.service.locate('media-1', 640)).toBeNull();
    expect(warn).not.toHaveBeenCalled();
  });
});

describe('serve, for a vehicle image (R45)', () => {
  it.each(['DRAFT', 'PENDING_REVIEW', 'CHANGES_REQUESTED', 'REJECTED', 'SOLD', 'WITHDRAWN'])(
    'refuses an image whose listing is %s',
    async (status) => {
      const h = setup({
        objectBody: Buffer.from('x'),
        media: { attachment: { vehicle: { listing: { status, dealer: { status: 'ACTIVE' } } } } },
      });

      expect(await h.service.serve('media-1', 640)).toBeNull();
    },
  );

  it('refuses a vehicle image attached to nothing', async () => {
    const h = setup({ objectBody: Buffer.from('x'), media: { attachment: null } });

    expect(await h.service.serve('media-1', 640)).toBeNull();
  });

  it('refuses a vehicle image whose vehicle has no listing', async () => {
    const h = setup({
      objectBody: Buffer.from('x'),
      media: { attachment: { vehicle: { listing: null } } },
    });

    expect(await h.service.serve('media-1', 640)).toBeNull();
  });

  it.each(['ACTIVE', 'RESERVED'])(
    'serves an image whose listing is %s — a reserved car is still on show (R71)',
    async (status) => {
      const h = setup({
        objectBody: Buffer.from('x'),
        media: { attachment: { vehicle: { listing: { status, dealer: { status: 'ACTIVE' } } } } },
      });

      expect(await h.service.serve('media-1', 640)).toBeTruthy();
    },
  );

  it.each(['DRAFT', 'PENDING_APPROVAL', 'SUSPENDED'])(
    'refuses a visible listing image whose dealer is %s (BUG-004)',
    async (dealerStatus) => {
      const h = setup({
        objectBody: Buffer.from('x'),
        media: {
          attachment: {
            vehicle: { listing: { status: 'ACTIVE', dealer: { status: dealerStatus } } },
          },
        },
      });
      expect(await h.service.serve('media-1', 640)).toBeNull();
    },
  );

  it.each(['DEALER_PORTFOLIO', 'DEALER_COVER'])(
    'serves an approved %s photograph of an ACTIVE dealership',
    async (ownerType) => {
      const h = setup({ objectBody: Buffer.from('x'), media: { ownerType, attachment: null } });

      expect(await h.service.serve('media-1', 640)).toBeTruthy();
    },
  );

  it.each(['DEALER_PORTFOLIO', 'DEALER_COVER'])(
    'does not serve a %s photograph without an approved row of an ACTIVE dealership (#299, BUG-NEW-009)',
    async (ownerType) => {
      const h = setup({
        objectBody: Buffer.from('x'),
        media: { ownerType, attachment: null },
        approvedPortfolioRows: 0,
      });

      expect(await h.service.serve('media-1', 640)).toBeNull();
    },
  );

  it.each(['DEALER_LOGO', 'DEALER_DOCUMENT', 'DEALER_YARD_VISIT'])(
    'serves no %s media on the public path',
    async (ownerType) => {
      const h = setup({ objectBody: Buffer.from('x'), media: { ownerType, attachment: null } });

      expect(await h.service.serve('media-1', 640)).toBeNull();
    },
  );
});

describe('toMediaStatus', () => {
  it('maps the storage lifecycle onto the four states the contract exposes', () => {
    expect(toMediaStatus('READY')).toBe('READY');
    expect(toMediaStatus('PENDING')).toBe('PROCESSING');
    expect(toMediaStatus('FAILED')).toBe('FAILED');
  });

  it('reports ORPHAN as FAILED, because a dealer cannot act on it', () => {
    expect(toMediaStatus('ORPHAN')).toBe('FAILED');
    expect(toMediaStatus('anything-else')).toBe('FAILED');
  });
});
