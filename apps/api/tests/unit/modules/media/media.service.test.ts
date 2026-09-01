import type { PrismaClient } from '@prisma/client';
import sharp from 'sharp';
import { describe, expect, it, vi } from 'vitest';

import { createMediaService, toMediaStatus } from '../../../../src/modules/media/media.service.js';
import type { PlatformConfigService } from '../../../../src/platform/config/platform-config.js';
import { ConflictError, DomainError, NotFoundError } from '../../../../src/platform/errors.js';
import type { Queue } from '../../../../src/platform/jobs/queue.js';
import { mediaUrl } from '../../../../src/platform/media/urls.js';
import type { StoragePort } from '../../../../src/platform/storage/storage.port.js';
import { logger } from '../../../../src/platform/telemetry/logger.js';

/**
 * Unit tests for `src/modules/media/media.service.ts`.
 *
 * The upload path is the one place in this API where bytes from the internet get
 * decoded, and §12.1 is explicit about what that means: never trust the declared
 * `Content-Type`, verify magic bytes, **fully re-encode** rather than transform in
 * place, and strip EXIF because the GPS coordinates of a dealer's yard are PII.
 * The integration suite cannot exercise any of that — it never uploads real image
 * bytes — so `process()` is driven here against images sharp actually produces,
 * including a file whose extension and mime lie about its contents.
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
  vehicles?: { vehicleId: string; mediaId: string; position: number }[];
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
  vehicle?: Record<string, unknown> | null;
  vehicleMediaCount?: number;
  nextMedia?: { mediaId: string } | null;
  objectBytes?: number | null;
  objectBody?: Buffer | null;
  minPhotos?: number;
  readyCount?: number;
}

function setup(options: Fakes = {}) {
  const mediaUpdates: { where: { id: string }; data: Record<string, unknown> }[] = [];
  const mediaCreates: Record<string, unknown>[] = [];
  const vehicleMediaUpserts: unknown[] = [];
  const vehicleMediaUpdates: unknown[] = [];
  const vehicleMediaDeletes: unknown[] = [];
  const vehicleUpdates: { where: { id: string }; data: Record<string, unknown> }[] = [];
  const sent: { name: string; data: Record<string, unknown> }[] = [];
  const puts: { key: string; body: Buffer; contentType: string }[] = [];

  const row = options.media === null ? null : mediaRow(options.media ?? {});

  const tx = {
    vehicleMedia: {
      update: (args: unknown) => {
        vehicleMediaUpdates.push(args);
        return Promise.resolve({});
      },
      deleteMany: (args: unknown) => {
        vehicleMediaDeletes.push(args);
        return Promise.resolve({ count: 1 });
      },
      findFirst: () => Promise.resolve(options.nextMedia ?? null),
    },
    vehicle: {
      update: (args: { where: { id: string }; data: Record<string, unknown> }) => {
        vehicleUpdates.push(args);
        return Promise.resolve({});
      },
    },
    media: {
      update: (args: { where: { id: string }; data: Record<string, unknown> }) => {
        mediaUpdates.push(args);
        return Promise.resolve({});
      },
    },
  };

  const prisma = {
    vehicle: {
      findFirst: () => Promise.resolve(options.vehicle ?? null),
      findUnique: () => Promise.resolve(options.vehicle ?? null),
    },
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
    vehicleMedia: {
      count: () => Promise.resolve(options.readyCount ?? options.vehicleMediaCount ?? 0),
      upsert: (args: unknown) => {
        vehicleMediaUpserts.push(args);
        return Promise.resolve({});
      },
    },
    $transaction: <T>(work: (handle: typeof tx) => Promise<T>) => work(tx),
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
    put: (key: string, body: Buffer, contentType: string) => {
      puts.push({ key, body, contentType });
      return Promise.resolve();
    },
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

  const config = {
    number: () => Promise.resolve(options.minPhotos ?? 6),
    boolean: () => Promise.resolve(false),
    stringList: () => Promise.resolve([]),
    all: () => Promise.resolve([]),
    set: () => Promise.reject(new Error('not used')),
    flag: () => Promise.resolve(false),
    flags: () => Promise.resolve({}),
    invalidate: () => Promise.resolve(),
  } as unknown as PlatformConfigService;

  return {
    service: createMediaService({ prisma, storage, queue, config }),
    mediaUpdates,
    mediaCreates,
    vehicleMediaUpserts,
    vehicleMediaUpdates,
    vehicleMediaDeletes,
    vehicleUpdates,
    sent,
    puts,
  };
}

/** A real image, so `process()` is tested against bytes sharp will actually decode. */
async function image(
  width: number,
  height: number,
  format: 'jpeg' | 'png' | 'webp' | 'gif' = 'jpeg',
): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: { r: 40, g: 90, b: 160 } },
  })
    [format]()
    .toBuffer();
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
    const h = setup({ vehicle: { id: 'vehicle-1', media: [] } });

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
    const h = setup({ vehicle: { id: 'vehicle-1', media: [] } });

    const presigned = await h.service.presign('dealer-1', input);

    expect(presigned.method).toBe('PUT');
    expect(presigned.headers['Content-Type']).toBe('image/jpeg');
    expect(presigned.expiresInSeconds).toBe(300);
    expect(presigned.maxBytes).toBe(10 * 1024 * 1024);
  });

  it('keys the object by owner and media id', async () => {
    const h = setup({ vehicle: { id: 'vehicle-1', media: [] } });

    const presigned = await h.service.presign('dealer-1', input);

    expect(h.mediaCreates[0]?.storageKey).toBe(`vehicles/vehicle-1/${presigned.mediaId}/original`);
  });

  it('mints a fresh media id per presign', async () => {
    const h = setup({ vehicle: { id: 'vehicle-1', media: [] } });

    const first = await h.service.presign('dealer-1', input);
    const second = await h.service.presign('dealer-1', input);

    expect(first.mediaId).not.toBe(second.mediaId);
  });

  it('404s a vehicle the dealer does not own', async () => {
    const h = setup({ vehicle: null });

    // 404 rather than 403: a 403 would confirm the id exists (§7).
    await expect(h.service.presign('dealer-1', input)).rejects.toThrow(NotFoundError);
    expect(h.mediaCreates).toEqual([]);
  });

  it('refuses the 21st photo on a vehicle', async () => {
    const h = setup({
      vehicle: {
        id: 'vehicle-1',
        media: Array.from({ length: 20 }, (_, i) => ({ mediaId: `m${i}` })),
      },
    });

    await expect(h.service.presign('dealer-1', input)).rejects.toThrow(DomainError);
    await expect(h.service.presign('dealer-1', input)).rejects.toThrow(/at most 20 photos/);
  });

  it('allows the 20th photo', async () => {
    const h = setup({
      vehicle: {
        id: 'vehicle-1',
        media: Array.from({ length: 19 }, (_, i) => ({ mediaId: `m${i}` })),
      },
    });

    await expect(h.service.presign('dealer-1', input)).resolves.toBeDefined();
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
      const h = setup({ vehicle: null });

      await expect(
        h.service.presign('dealer-1', { ...input, ownerType, ownerId: 'dealer-1' }),
      ).resolves.toBeDefined();
    },
  );

  it('still refuses a VEHICLE upload for a car the dealer does not own', async () => {
    const h = setup({ vehicle: null });

    await expect(h.service.presign('dealer-1', { ...input, ownerType: 'VEHICLE' })).rejects.toThrow(
      'That vehicle does not exist.',
    );
  });

  it('stores declared dimensions when the client measured them', async () => {
    const h = setup({ vehicle: { id: 'vehicle-1', media: [] } });

    await h.service.presign('dealer-1', { ...input, width: 1920, height: 1080 });

    expect(h.mediaCreates[0]).toMatchObject({ width: 1920, height: 1080 });
  });

  it('stores null dimensions when it did not', async () => {
    const h = setup({ vehicle: { id: 'vehicle-1', media: [] } });

    await h.service.presign('dealer-1', input);

    expect(h.mediaCreates[0]).toMatchObject({ width: null, height: null });
  });
});

describe('commit', () => {
  it('links the media to its vehicle and queues processing', async () => {
    const h = setup({ objectBytes: 1024, vehicleMediaCount: 2 });

    const result = await h.service.commit('dealer-1', 'media-1');

    expect(h.vehicleMediaUpserts).toHaveLength(1);
    expect(h.sent).toEqual([{ name: 'media.process', data: { mediaId: 'media-1' } }]);
    expect(result.status).toBe('PROCESSING');
    expect(result.poll).toBe('/v1/dealer/media/media-1');
    expect(result.estimatedSeconds).toBe(6);
  });

  it('appends to the end of the gallery when no position is given', async () => {
    const h = setup({ objectBytes: 1024, vehicleMediaCount: 3 });

    await h.service.commit('dealer-1', 'media-1');

    expect(h.vehicleMediaUpserts[0]).toMatchObject({
      create: { vehicleId: 'vehicle-1', mediaId: 'media-1', position: 3 },
      update: { position: 3 },
    });
  });

  it('honours an explicit position', async () => {
    const h = setup({ objectBytes: 1024, vehicleMediaCount: 3 });

    const result = await h.service.commit('dealer-1', 'media-1', 0);

    expect(h.vehicleMediaUpserts[0]).toMatchObject({ update: { position: 0 } });
    expect(result.position).toBe(0);
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

  it('does not link a KYC document to a vehicle', async () => {
    const h = setup({
      objectBytes: 1024,
      media: { ownerType: 'DEALER_DOC', storageKey: 'dealers/dealer-1/kyc/media-1/original' },
    });

    await h.service.commit('dealer-1', 'media-1');

    expect(h.vehicleMediaUpserts).toEqual([]);
    expect(h.sent).toHaveLength(1);
  });

  it('queues processing even when the storage key has no vehicle segment', async () => {
    const h = setup({ objectBytes: 1024, media: { storageKey: 'original' } });

    await h.service.commit('dealer-1', 'media-1');

    expect(h.vehicleMediaUpserts).toEqual([]);
    expect(h.sent).toHaveLength(1);
  });
});

describe('get', () => {
  it('returns the delivery URL only once the image is ready', async () => {
    const ready = setup({
      media: { status: 'READY', blurhash: 'L6PZ', width: 1600, height: 1200, vehicles: [] },
    });
    const pending = setup({ media: { status: 'PENDING', vehicles: [] } });

    expect((await ready.service.get('dealer-1', 'media-1')).url).toBe(mediaUrl('media-1', 1024));
    // A URL for an unprocessed image is a broken <img> on the dealer's screen.
    expect((await pending.service.get('dealer-1', 'media-1')).url).toBeNull();
  });

  it('reports the position from the vehicle link', async () => {
    const h = setup({
      media: { vehicles: [{ vehicleId: 'vehicle-1', mediaId: 'media-1', position: 4 }] },
      vehicle: { id: 'vehicle-1', primaryMediaId: 'other' },
    });

    const dto = await h.service.get('dealer-1', 'media-1');

    expect(dto.position).toBe(4);
    expect(dto.isPrimary).toBe(false);
  });

  it('marks the primary image', async () => {
    const h = setup({
      media: { vehicles: [{ vehicleId: 'vehicle-1', mediaId: 'media-1', position: 0 }] },
      vehicle: { id: 'vehicle-1', primaryMediaId: 'media-1' },
    });

    expect((await h.service.get('dealer-1', 'media-1')).isPrimary).toBe(true);
  });

  it('defaults position to 0 and isPrimary to false for an unlinked upload', async () => {
    const h = setup({ media: { vehicles: [] } });

    const dto = await h.service.get('dealer-1', 'media-1');

    expect(dto.position).toBe(0);
    expect(dto.isPrimary).toBe(false);
  });

  it('passes through the warnings the processor recorded', async () => {
    const h = setup({ media: { status: 'READY', warnings: ['TOO_SMALL'], vehicles: [] } });

    expect((await h.service.get('dealer-1', 'media-1')).warnings).toEqual(['TOO_SMALL']);
  });

  it('404s an upload belonging to another dealer', async () => {
    const h = setup({ media: null });

    await expect(h.service.get('dealer-1', 'media-1')).rejects.toThrow(NotFoundError);
  });
});

describe('reorder', () => {
  const vehicle = {
    id: 'vehicle-1',
    media: [{ mediaId: 'a' }, { mediaId: 'b' }, { mediaId: 'c' }],
  };

  it('writes the full order and promotes the first as primary', async () => {
    const h = setup({ vehicle });

    const result = await h.service.reorder('dealer-1', 'vehicle-1', {
      mediaIds: ['c', 'a', 'b'],
    });

    expect(h.vehicleMediaUpdates).toHaveLength(3);
    expect(h.vehicleUpdates[0]).toEqual({
      where: { id: 'vehicle-1' },
      data: { primaryMediaId: 'c' },
    });
    expect(result.media).toEqual([
      { mediaId: 'c', position: 0, isPrimary: true },
      { mediaId: 'a', position: 1, isPrimary: false },
      { mediaId: 'b', position: 2, isPrimary: false },
    ]);
  });

  it('assigns positions from the array index, so there is no partial swap', async () => {
    const h = setup({ vehicle });

    await h.service.reorder('dealer-1', 'vehicle-1', { mediaIds: ['b', 'c', 'a'] });

    // §12.2: the full ordered array, always. A two-element swap leaves a
    // duplicate position the moment two requests race.
    expect(h.vehicleMediaUpdates).toEqual([
      {
        where: { vehicleId_mediaId: { vehicleId: 'vehicle-1', mediaId: 'b' } },
        data: { position: 0 },
      },
      {
        where: { vehicleId_mediaId: { vehicleId: 'vehicle-1', mediaId: 'c' } },
        data: { position: 1 },
      },
      {
        where: { vehicleId_mediaId: { vehicleId: 'vehicle-1', mediaId: 'a' } },
        data: { position: 2 },
      },
    ]);
  });

  it('clears the primary image when handed an empty order', async () => {
    const h = setup({ vehicle });

    await h.service.reorder('dealer-1', 'vehicle-1', { mediaIds: [] });

    expect(h.vehicleUpdates[0]?.data.primaryMediaId).toBeNull();
  });

  it('404s a vehicle the dealer does not own', async () => {
    const h = setup({ vehicle: null });

    await expect(h.service.reorder('dealer-1', 'vehicle-1', { mediaIds: ['a'] })).rejects.toThrow(
      NotFoundError,
    );
  });

  it('refuses an order naming a photo from another vehicle', async () => {
    const h = setup({ vehicle });

    // Otherwise a dealer could reorder their own gallery into someone else's.
    await expect(
      h.service.reorder('dealer-1', 'vehicle-1', { mediaIds: ['a', 'someone-elses'] }),
    ).rejects.toThrow(/does not belong to this vehicle/);
    expect(h.vehicleMediaUpdates).toEqual([]);
  });

  it('accepts a partial order of photos it does own', async () => {
    const h = setup({ vehicle });

    await expect(
      h.service.reorder('dealer-1', 'vehicle-1', { mediaIds: ['b'] }),
    ).resolves.toMatchObject({ media: [{ mediaId: 'b', position: 0, isPrimary: true }] });
  });
});

describe('remove', () => {
  it('orphans the row and unlinks it from the vehicle', async () => {
    const h = setup({
      media: { vehicles: [{ vehicleId: 'vehicle-1', mediaId: 'media-1', position: 0 }] },
      vehicle: { id: 'vehicle-1', listings: [] },
      nextMedia: { mediaId: 'media-2' },
    });

    await h.service.remove('dealer-1', 'media-1');

    // ORPHAN rather than a delete: the bytes are collected by a sweep, so the
    // request does not wait on storage.
    expect(h.mediaUpdates[0]).toEqual({
      where: { id: 'media-1' },
      data: { status: 'ORPHAN' },
    });
    expect(h.vehicleMediaDeletes).toEqual([{ where: { mediaId: 'media-1' } }]);
  });

  it('promotes the next photo to primary', async () => {
    const h = setup({
      media: { vehicles: [{ vehicleId: 'vehicle-1', mediaId: 'media-1', position: 0 }] },
      vehicle: { id: 'vehicle-1', listings: [] },
      nextMedia: { mediaId: 'media-2' },
    });

    await h.service.remove('dealer-1', 'media-1');

    expect(h.vehicleUpdates[0]).toEqual({
      where: { id: 'vehicle-1' },
      data: { primaryMediaId: 'media-2' },
    });
  });

  it('clears the primary image when the last photo goes', async () => {
    const h = setup({
      media: { vehicles: [{ vehicleId: 'vehicle-1', mediaId: 'media-1', position: 0 }] },
      vehicle: { id: 'vehicle-1', listings: [] },
      nextMedia: null,
    });

    await h.service.remove('dealer-1', 'media-1');

    expect(h.vehicleUpdates[0]?.data.primaryMediaId).toBeNull();
  });

  it('refuses to take a live listing below the photo minimum', async () => {
    const h = setup({
      media: { vehicles: [{ vehicleId: 'vehicle-1', mediaId: 'media-1', position: 0 }] },
      vehicle: { id: 'vehicle-1', listings: [{ status: 'APPROVED' }] },
      readyCount: 6,
      minPhotos: 6,
    });

    // Allowing it would publish a listing that could not have been submitted.
    await expect(h.service.remove('dealer-1', 'media-1')).rejects.toThrow(ConflictError);
    await expect(h.service.remove('dealer-1', 'media-1')).rejects.toThrow(/at least 6 photos/);
  });

  it('allows the removal when enough photos remain', async () => {
    const h = setup({
      media: { vehicles: [{ vehicleId: 'vehicle-1', mediaId: 'media-1', position: 0 }] },
      vehicle: { id: 'vehicle-1', listings: [{ status: 'APPROVED' }] },
      readyCount: 7,
      minPhotos: 6,
    });

    await expect(h.service.remove('dealer-1', 'media-1')).resolves.toBeUndefined();
  });

  it('does not apply the minimum to a draft', async () => {
    const h = setup({
      media: { vehicles: [{ vehicleId: 'vehicle-1', mediaId: 'media-1', position: 0 }] },
      vehicle: { id: 'vehicle-1', listings: [{ status: 'DRAFT' }] },
      readyCount: 1,
      minPhotos: 6,
    });

    // A dealer mid-upload must be able to delete a bad photo.
    await expect(h.service.remove('dealer-1', 'media-1')).resolves.toBeUndefined();
  });

  it('reads the minimum from platform config rather than a constant', async () => {
    const h = setup({
      media: { vehicles: [{ vehicleId: 'vehicle-1', mediaId: 'media-1', position: 0 }] },
      vehicle: { id: 'vehicle-1', listings: [{ status: 'APPROVED' }] },
      readyCount: 8,
      minPhotos: 8,
    });

    await expect(h.service.remove('dealer-1', 'media-1')).rejects.toThrow(/at least 8 photos/);
  });

  it('skips the listing check for an unlinked upload', async () => {
    const h = setup({ media: { vehicles: [] } });

    await h.service.remove('dealer-1', 'media-1');

    expect(h.vehicleUpdates).toEqual([]);
    expect(h.mediaUpdates[0]?.data.status).toBe('ORPHAN');
  });

  it('404s an upload belonging to another dealer', async () => {
    const h = setup({ media: null });

    await expect(h.service.remove('dealer-1', 'media-1')).rejects.toThrow(NotFoundError);
  });
});

describe('process', () => {
  it('re-encodes to webp at every width at or below the original', async () => {
    const original = await image(1024, 768);
    const h = setup({ objectBody: original, media: { bytes: original.byteLength } });

    await h.service.process('media-1');

    // 1600 is skipped: never upscale. 320 is always written so a card always has
    // something to render.
    expect(h.puts.map((put) => put.key)).toEqual([
      'vehicles/vehicle-1/media-1/320.webp',
      'vehicles/vehicle-1/media-1/640.webp',
      'vehicles/vehicle-1/media-1/1024.webp',
    ]);
    for (const put of h.puts) expect(put.contentType).toBe('image/webp');
  });

  it('always writes the smallest width even for a tiny original', async () => {
    const h = setup({ objectBody: await image(120, 90) });

    await h.service.process('media-1');

    expect(h.puts.map((put) => put.key)).toEqual(['vehicles/vehicle-1/media-1/320.webp']);
  });

  it('produces real webp bytes, not the original re-labelled', async () => {
    const h = setup({ objectBody: await image(800, 600, 'png') });

    await h.service.process('media-1');

    const written = h.puts[0]?.body;
    expect(written).toBeDefined();
    expect((await sharp(written as Buffer).metadata()).format).toBe('webp');
  });

  it('strips EXIF, because a yard’s GPS coordinates are PII', async () => {
    const withExif = await sharp({
      create: { width: 900, height: 600, channels: 3, background: '#123456' },
    })
      .withExif({ IFD0: { Copyright: 'Sri Lakshmi Motors', Software: 'unit-test' } })
      .jpeg()
      .toBuffer();
    const h = setup({ objectBody: withExif });

    await h.service.process('media-1');

    const written = h.puts.at(-1)?.body as Buffer;
    const metadata = await sharp(written).metadata();
    // A full re-decode drops every tag with it; a transform in place would not.
    expect(metadata.exif).toBeUndefined();
  });

  it('records dimensions, a blurhash and READY', async () => {
    const h = setup({ objectBody: await image(1000, 750) });

    await h.service.process('media-1');

    const update = h.mediaUpdates[0]?.data;
    expect(update).toMatchObject({ status: 'READY', width: 1000, height: 750 });
    expect(String(update?.blurhash).length).toBeGreaterThan(6);
    expect(update?.variants).toMatchObject({
      '320': 'vehicles/vehicle-1/media-1/320.webp',
    });
  });

  it('rejects a file whose magic bytes are not an image we accept', async () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
    // A GIF passes a `image/jpeg` content-type check and fails here, which is the
    // entire point of not trusting the declared mime.
    const h = setup({ objectBody: await image(400, 300, 'gif') });

    await h.service.process('media-1');

    expect(h.mediaUpdates[0]).toEqual({
      where: { id: 'media-1' },
      data: { status: 'FAILED', warnings: ['UNSUPPORTED_FORMAT'] },
    });
    expect(h.puts).toEqual([]);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('fails a file that is not an image at all', async () => {
    const error = vi.spyOn(logger, 'error').mockImplementation(() => undefined);
    const h = setup({ objectBody: Buffer.from('#!/bin/sh\nrm -rf /\n') });

    await h.service.process('media-1');

    expect(h.mediaUpdates.at(-1)).toEqual({
      where: { id: 'media-1' },
      data: { status: 'FAILED' },
    });
    error.mockRestore();
  });

  it('warns about an image too small to be useful', async () => {
    const h = setup({ objectBody: await image(600, 450) });

    await h.service.process('media-1');

    expect(h.mediaUpdates[0]?.data.warnings).toContain('TOO_SMALL');
    // Advisory, not fatal: the listing still publishes.
    expect(h.mediaUpdates[0]?.data.status).toBe('READY');
  });

  it('warns about an extreme aspect ratio in either direction', async () => {
    const wide = setup({ objectBody: await image(2400, 800) });
    const tall = setup({ objectBody: await image(800, 1600) });

    await wide.service.process('media-1');
    await tall.service.process('media-1');

    expect(wide.mediaUpdates[0]?.data.warnings).toContain('EXTREME_ASPECT');
    expect(tall.mediaUpdates[0]?.data.warnings).toContain('EXTREME_ASPECT');
  });

  it('leaves a well-shaped photo unwarned', async () => {
    const h = setup({ objectBody: await image(1600, 1200) });

    await h.service.process('media-1');

    expect(h.mediaUpdates[0]?.data.warnings).toEqual([]);
  });

  it('keeps the dealer’s own file name when there is one', async () => {
    const h = setup({ objectBody: await image(900, 600), media: { fileName: 'front-left.jpg' } });

    await h.service.process('media-1');

    expect(h.mediaUpdates[0]?.data.fileName).toBe('front-left.jpg');
  });

  it('invents a file name when the upload had none', async () => {
    const h = setup({ objectBody: await image(900, 600), media: { fileName: null } });

    await h.service.process('media-1');

    expect(String(h.mediaUpdates[0]?.data.fileName)).toMatch(/\.webp$/);
  });

  it('does nothing for a media row that has gone', async () => {
    const h = setup({ media: null });

    await expect(h.service.process('media-1')).resolves.toBeUndefined();
    expect(h.mediaUpdates).toEqual([]);
  });

  it('fails the row when the object is missing from storage', async () => {
    const h = setup({ objectBody: null });

    await h.service.process('media-1');

    expect(h.mediaUpdates[0]).toEqual({
      where: { id: 'media-1' },
      data: { status: 'FAILED' },
    });
    expect(h.puts).toEqual([]);
  });

  it('is idempotent — processing twice lands the same result', async () => {
    const body = await image(1024, 768);
    const h = setup({ objectBody: body });

    await h.service.process('media-1');
    await h.service.process('media-1');

    expect(h.mediaUpdates).toHaveLength(2);
    expect(h.mediaUpdates[0]?.data.status).toBe('READY');
    expect(h.mediaUpdates[1]?.data.status).toBe('READY');
    expect(h.mediaUpdates[0]?.data.variants).toEqual(h.mediaUpdates[1]?.data.variants);
  });
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
