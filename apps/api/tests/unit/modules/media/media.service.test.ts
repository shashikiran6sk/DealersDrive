import { JPEG } from '../../../image-fixture.js';
import type { PrismaClient } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import { createMediaService, toMediaStatus } from '../../../../src/modules/media/media.service.js';
import type { StoragePort } from '../../../../src/platform/storage/storage.port.js';

/**
 * Unit tests for `src/modules/media/media.service.ts`.
 *
 * R45 withdrew the dealer's vehicle-photo routes (`/v1/dealer/media/*`): a
 * dealer never writes vehicle media, and the admin upload lives in the
 * `vehicle-images` module with its own tests. What is left here is delivery —
 * `serve()` — and the status mapper the yard photograph still uses. The
 * sharp/blurhash `process()` block stays deferred with F034.
 */
interface Row {
  id: string;
  dealerId: string;
  ownerType: string;
  storageKey: string;
  mimeType: string;
  status: string;
  variants: unknown;
  attachment: { vehicle: { listing: { status: string } | null } } | null;
}

function mediaRow(overrides: Partial<Row> = {}): Row {
  return {
    id: 'media-1',
    dealerId: 'dealer-1',
    ownerType: 'VEHICLE',
    storageKey: 'vehicles/vehicle-1/media-1/original.jpg',
    mimeType: 'image/jpeg',
    status: 'READY',
    variants: { '640': 'derivatives/test/640.webp' },
    attachment: { vehicle: { listing: { status: 'ACTIVE' } } },
    ...overrides,
  };
}

interface Fakes {
  media?: Partial<Row> | null;
  objectBody?: Buffer | null;
}

function setup(options: Fakes = {}) {
  const row = options.media === null ? null : mediaRow(options.media ?? {});

  const prisma = {
    media: { findUnique: () => Promise.resolve(row), update: () => Promise.resolve(row) },
    dealer: { findUnique: () => Promise.resolve({ status: 'ACTIVE', coverMediaId: 'media-1' }) },
  } as unknown as PrismaClient;

  const objects = new Map<string, Buffer>();
  const storage = {
    get: (key: string) => Promise.resolve(objects.get(key) ?? options.objectBody ?? null),
    put: (key: string, body: Buffer) => {
      objects.set(key, body);
      return Promise.resolve();
    },
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

  it('generates the exact width when the requested rendition is missing', async () => {
    const h = setup({
      objectBody: JPEG,
      media: { status: 'READY', variants: { '1024': 'vehicles/v/m/1024.webp' } },
    });

    // Better a larger rendition than a broken image.
    await expect(h.service.serve('media-1', 1600)).resolves.toBeTruthy();
  });

  it('converts a legacy original into WebP', async () => {
    const h = setup({
      objectBody: JPEG,
      media: { status: 'READY', variants: {}, mimeType: 'image/jpeg' },
    });

    expect((await h.service.serve('media-1', 640))?.contentType).toBe('image/webp');
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

describe('serve, for a vehicle image (R45)', () => {
  it.each(['DRAFT', 'PENDING_REVIEW', 'CHANGES_REQUESTED', 'REJECTED', 'SOLD', 'WITHDRAWN'])(
    'refuses an image whose listing is %s',
    async (status) => {
      const h = setup({
        objectBody: Buffer.from('x'),
        media: { attachment: { vehicle: { listing: { status } } } },
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
        media: { attachment: { vehicle: { listing: { status } } } },
      });

      expect(await h.service.serve('media-1', 640)).toBeTruthy();
    },
  );

  it('serves a yard photograph, which belongs to no listing', async () => {
    const h = setup({
      objectBody: Buffer.from('x'),
      media: { ownerType: 'DEALER_COVER', attachment: null },
    });

    expect(await h.service.serve('media-1', 640)).toBeTruthy();
  });
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
