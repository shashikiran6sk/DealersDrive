import type { PrismaClient } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import { createMediaService, toMediaStatus } from '../../../../src/modules/media/media.service.js';
import { DomainError, NotFoundError } from '../../../../src/platform/errors.js';
import type { Queue } from '../../../../src/platform/jobs/queue.js';
import { mediaUrl } from '../../../../src/platform/media/urls.js';
import type { StoragePort } from '../../../../src/platform/storage/storage.port.js';

/**
 * Unit tests for `src/modules/media/media.service.ts`.
 *
 * ── Reconstruction slice ────────────────────────────────────────────────────
 * The baseline file is 909 lines covering three features. Two whole blocks are
 * deferred with the code they test:
 *
 *   · `describe('process')` — the sharp/blurhash pipeline, **F034**. It is the
 *     most valuable block in the file: it drives `process()` against images
 *     sharp actually produces, including a file whose extension and mime lie
 *     about its contents, because §12.1's "verify magic bytes, fully re-encode,
 *     strip EXIF" cannot be exercised by the integration suite. It must come
 *     back with the pipeline, not after it.
 *   · `describe('reorder')` — position and the primary photo, **F035**.
 *
 * Individual cases that assert against `Vehicle` or `VehicleMedia` are deferred
 * where they sit, each marked. Everything else is the baseline's, verbatim.
 * ────────────────────────────────────────────────────────────────────────────
 */
interface Row {
  id: string;
  dealerId: string;
  ownerType: string;
  storageKey: string;
  mimeType: string;
  bytes: number;
  width: number | null;
  height: number | null;
  fileName: string | null;
  status: string;
  blurhash: string | null;
  variants: unknown;
  warnings: string[];
  uploadedByAdmin: boolean;
}

function mediaRow(overrides: Partial<Row> = {}): Row {
  return {
    id: 'media-1',
    dealerId: 'dealer-1',
    ownerType: 'VEHICLE',
    storageKey: 'vehicles/vehicle-1/media-1/original',
    mimeType: 'image/jpeg',
    bytes: 1024,
    width: null,
    height: null,
    fileName: 'front.jpg',
    status: 'PENDING',
    blurhash: null,
    variants: {},
    warnings: [],
    uploadedByAdmin: false,
    ...overrides,
  };
}

interface Fakes {
  media?: Partial<Row> | null;
  objectBytes?: number | null;
  objectBody?: Buffer | null;
}

function setup(options: Fakes = {}) {
  const mediaUpdates: { where: { id: string }; data: Record<string, unknown> }[] = [];
  const mediaCreates: Record<string, unknown>[] = [];
  const sent: { name: string; data: Record<string, unknown> }[] = [];

  const row = options.media === null ? null : mediaRow(options.media ?? {});

  const prisma = {
    media: {
      findFirst: () => Promise.resolve(row),
      findUnique: () => Promise.resolve(row),
      create: (args: { data: Record<string, unknown> }) => {
        mediaCreates.push(args.data);
        return Promise.resolve({});
      },
      update: (args: { where: { id: string }; data: Record<string, unknown> }) => {
        mediaUpdates.push(args);
        return Promise.resolve({});
      },
    },
  } as unknown as PrismaClient;

  const storage = {
    presignPut: ({ key, contentType }: { key: string; contentType: string }) => ({
      uploadUrl: `https://storage.test/uploads?key=${key}`,
      method: 'PUT' as const,
      headers: { 'Content-Type': contentType },
      expiresInSeconds: 300,
    }),
    head: () =>
      Promise.resolve(
        options.objectBytes === null || options.objectBytes === undefined
          ? null
          : { bytes: options.objectBytes, contentType: 'image/jpeg' },
      ),
    get: () => Promise.resolve(options.objectBody ?? null),
    put: () => Promise.resolve(),
    delete: () => Promise.resolve(),
    publicUrl: (key: string) => `https://media.test/${key}`,
    signedReadUrl: (key: string) => `https://media.test/${key}?signed`,
  } as unknown as StoragePort;

  const queue = {
    send: (name: string, data: Record<string, unknown>) => {
      sent.push({ name, data });
      return Promise.resolve();
    },
    work: () => Promise.resolve(),
    schedule: () => Promise.resolve(),
    start: () => Promise.resolve(),
    stop: () => Promise.resolve(),
  } as unknown as Queue;

  return {
    service: createMediaService({ prisma, storage, queue }),
    mediaUpdates,
    mediaCreates,
    sent,
  };
}

describe('presign', () => {
  const input = {
    ownerType: 'VEHICLE' as const,
    ownerId: 'vehicle-1',
    mimeType: 'image/jpeg' as const,
    bytes: 2048,
    fileName: 'front.jpg',
  };

  it('creates a PENDING row with the dealer from the session', async () => {
    const h = setup();

    await h.service.presign('dealer-1', input);

    // §12.1: `dealerId` comes from the session, never from the payload — there is
    // no field in `MediaPresignInput` that could carry one.
    expect(h.mediaCreates[0]).toMatchObject({
      dealerId: 'dealer-1',
      status: 'PENDING',
      ownerType: 'VEHICLE',
      mimeType: 'image/jpeg',
      bytes: 2048,
      fileName: 'front.jpg',
    });
  });

  it('returns an upload URL with the declared content type', async () => {
    const h = setup();

    const presigned = await h.service.presign('dealer-1', input);

    expect(presigned.method).toBe('PUT');
    expect(presigned.headers['Content-Type']).toBe('image/jpeg');
    expect(presigned.expiresInSeconds).toBe(300);
    expect(presigned.maxBytes).toBe(10 * 1024 * 1024);
  });

  it('keys the object by owner and media id', async () => {
    const h = setup();

    const presigned = await h.service.presign('dealer-1', input);

    expect(h.mediaCreates[0]?.storageKey).toBe(`vehicles/vehicle-1/${presigned.mediaId}/original`);
  });

  it('mints a fresh media id per presign', async () => {
    const h = setup();

    const first = await h.service.presign('dealer-1', input);
    const second = await h.service.presign('dealer-1', input);

    expect(first.mediaId).not.toBe(second.mediaId);
  });

  /**
   * Only `VEHICLE` uploads have a vehicle to own. A logo or a cover image
   * belongs to the dealership itself, so running the ownership lookup would
   * 404 every branding upload — `ownerId` there is the dealer's own id, which
   * is not a vehicle.
   */
  it.each(['DEALER_LOGO', 'DEALER_COVER'] as const)(
    'skips the vehicle ownership check for a %s upload',
    async (ownerType) => {
      const h = setup();

      await expect(
        h.service.presign('dealer-1', { ...input, ownerType, ownerId: 'dealer-1' }),
      ).resolves.toBeDefined();
    },
  );

  it('stores declared dimensions when the client measured them', async () => {
    const h = setup();

    await h.service.presign('dealer-1', { ...input, width: 1920, height: 1080 });

    expect(h.mediaCreates[0]).toMatchObject({ width: 1920, height: 1080 });
  });

  it('stores null dimensions when it did not', async () => {
    const h = setup();

    await h.service.presign('dealer-1', input);

    expect(h.mediaCreates[0]).toMatchObject({ width: null, height: null });
  });

  /*
   * ── Reconstruction slice ──────────────────────────────────────────────────
   * Four cases wait on `Vehicle` (**F055**): `404s a vehicle the dealer does
   * not own`, `still refuses a VEHICLE upload for a car the dealer does not
   * own`, `refuses the 21st photo on a vehicle` and `allows the 20th photo`.
   *
   * ⚠️ The two quota cases are the ones to watch. Nothing else enforces
   * `MAX_PHOTOS_PER_VEHICLE`, so until F055 a dealer can presign without limit.
   * ──────────────────────────────────────────────────────────────────────────
   */
});

describe('commit', () => {
  it('queues processing and reports where to poll', async () => {
    const h = setup({ objectBytes: 1024 });

    const result = await h.service.commit('dealer-1', 'media-1');

    expect(h.sent).toEqual([{ name: 'media.process', data: { mediaId: 'media-1' } }]);
    expect(result.status).toBe('PROCESSING');
    expect(result.poll).toBe('/v1/dealer/media/media-1');
    expect(result.estimatedSeconds).toBe(6);
  });

  it('echoes an explicit position back to the client', async () => {
    const h = setup({ objectBytes: 1024 });

    expect((await h.service.commit('dealer-1', 'media-1', 0)).position).toBe(0);
  });

  it('reports READY when processing already finished', async () => {
    const h = setup({ objectBytes: 1024, media: { status: 'READY' } });

    expect((await h.service.commit('dealer-1', 'media-1')).status).toBe('READY');
  });

  it('404s an upload belonging to another dealer', async () => {
    const h = setup({ media: null });

    await expect(h.service.commit('dealer-1', 'media-1')).rejects.toThrow(NotFoundError);
  });

  it('reports UPLOAD_MISSING when nothing landed in storage', async () => {
    const h = setup({ objectBytes: null });

    await expect(h.service.commit('dealer-1', 'media-1')).rejects.toThrow(DomainError);
    await expect(h.service.commit('dealer-1', 'media-1')).rejects.toThrow(/did not complete/);
    expect(h.sent).toEqual([]);
  });

  it('fails the row when the uploaded size does not match what was declared', async () => {
    const h = setup({ objectBytes: 999_999, media: { bytes: 1024 } });

    await expect(h.service.commit('dealer-1', 'media-1')).rejects.toThrow(/does not match/);

    // §12.1 bakes content-length into the signature; a mismatch means the client
    // sent something other than what it asked to send.
    expect(h.mediaUpdates[0]).toEqual({
      where: { id: 'media-1' },
      data: { status: 'FAILED' },
    });
    expect(h.sent).toEqual([]);
  });

  it('queues processing even when the storage key has no vehicle segment', async () => {
    const h = setup({ objectBytes: 1024, media: { storageKey: 'original' } });

    await h.service.commit('dealer-1', 'media-1');

    expect(h.sent).toHaveLength(1);
  });

  /*
   * ── Reconstruction slice ──────────────────────────────────────────────────
   * Three cases assert the `VehicleMedia` upsert — `links the media to its
   * vehicle`, `appends to the end of the gallery when no position is given`
   * and `does not link a KYC document to a vehicle`. That link is **F035**;
   * `position` is accepted and echoed back meanwhile, so the contract is
   * unchanged and only the row is missing.
   * ──────────────────────────────────────────────────────────────────────────
   */
});

describe('get', () => {
  it('returns the delivery URL only once the image is ready', async () => {
    const ready = setup({
      media: { status: 'READY', blurhash: 'L6PZ', width: 1600, height: 1200 },
    });
    const pending = setup({ media: { status: 'PENDING' } });

    expect((await ready.service.get('dealer-1', 'media-1')).url).toBe(mediaUrl('media-1', 1024));
    // A URL for an unprocessed image is a broken <img> on the dealer's screen.
    expect((await pending.service.get('dealer-1', 'media-1')).url).toBeNull();
  });

  it('defaults position to 0 and isPrimary to false for an unlinked upload', async () => {
    const h = setup();

    const dto = await h.service.get('dealer-1', 'media-1');

    expect(dto.position).toBe(0);
    expect(dto.isPrimary).toBe(false);
  });

  it('passes through the warnings the processor recorded', async () => {
    const h = setup({ media: { status: 'READY', warnings: ['TOO_SMALL'] } });

    expect((await h.service.get('dealer-1', 'media-1')).warnings).toEqual(['TOO_SMALL']);
  });

  it('404s an upload belonging to another dealer', async () => {
    const h = setup({ media: null });

    await expect(h.service.get('dealer-1', 'media-1')).rejects.toThrow(NotFoundError);
  });

  /*
   * ── Reconstruction slice ──────────────────────────────────────────────────
   * `reports the position from the vehicle link` and `marks the primary image`
   * read `VehicleMedia.position` and `Vehicle.primaryMediaId` — **F035**. The
   * unlinked case above is the one that holds today, and it is the baseline's
   * own answer for an upload with no link.
   * ──────────────────────────────────────────────────────────────────────────
   */
});

describe('remove', () => {
  it('orphans the row rather than deleting it', async () => {
    const h = setup();

    await h.service.remove('dealer-1', 'media-1');

    // ORPHAN rather than a delete: the bytes are collected by a sweep, so the
    // request does not wait on storage.
    expect(h.mediaUpdates[0]).toEqual({
      where: { id: 'media-1' },
      data: { status: 'ORPHAN' },
    });
  });

  it('404s an upload belonging to another dealer', async () => {
    const h = setup({ media: null });

    await expect(h.service.remove('dealer-1', 'media-1')).rejects.toThrow(NotFoundError);
  });

  /*
   * ── Reconstruction slice ──────────────────────────────────────────────────
   * Six cases wait here, and one of them is a real guard rather than a
   * convenience:
   *
   *   `refuses to take a live listing below the photo minimum`
   *   `allows the removal when enough photos remain`
   *   `does not apply the minimum to a draft`
   *   `reads the minimum from platform config rather than a constant`
   *
   * ⚠️ Until they come back — with `Listing` (**F064**) and the
   * `PlatformConfigService` dependency this service drops meanwhile — nothing
   * stops a dealer emptying a live listing's gallery. There is no live listing
   * to empty yet, which is why this is safe today and not later.
   *
   * `promotes the next photo to primary` and `clears the primary image when
   * the last photo goes` need `VehicleMedia` (**F035**).
   * ──────────────────────────────────────────────────────────────────────────
   */
});

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
