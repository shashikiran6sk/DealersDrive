import type { PrismaClient } from '@prisma/client';
import sharp from 'sharp';
import { describe, expect, it, vi } from 'vitest';

import {
  createMediaProcessor,
  hasVariants,
} from '../../../../src/modules/media/media.processor.js';
import { createInlineQueue, type Queue } from '../../../../src/platform/jobs/queue.js';
import type { StoragePort } from '../../../../src/platform/storage/storage.port.js';

/**
 * Unit tests for `src/modules/media/media.processor.ts` (**F034**).
 *
 * The processor turns a committed vehicle photograph into the four widths
 * `GET /media/by-media/:id/:width.webp` serves. What is pinned here is when it
 * does that, when it leaves a row alone, and that a photograph it cannot read
 * never takes the upload down with it.
 */
const MEDIA_ID = '0f2ff36b-efd7-4018-afe5-ccd3d2dc4fa9';
const KEY = `vehicles/vehicle-1/${MEDIA_ID}/original.jpg`;
const DIR = `vehicles/vehicle-1/${MEDIA_ID}`;

interface Row {
  id: string;
  ownerType: string;
  storageKey: string;
  status: string;
  variants: unknown;
}

interface Fakes {
  media?: Partial<Row> | null;
  body?: Buffer | null;
  saved?: number;
  queue?: Queue;
}

async function jpeg(): Promise<Buffer> {
  return sharp({ create: { width: 1200, height: 900, channels: 3, background: '#555' } })
    .jpeg()
    .toBuffer();
}

function setup(options: Fakes = {}) {
  const row: Row | null =
    options.media === null
      ? null
      : {
          id: MEDIA_ID,
          ownerType: 'VEHICLE',
          storageKey: KEY,
          status: 'READY',
          variants: {},
          ...options.media,
        };
  const updateMany = vi.fn(() => Promise.resolve({ count: options.saved ?? 1 }));
  const prisma = {
    media: { findUnique: () => Promise.resolve(row), updateMany },
  } as unknown as PrismaClient;

  const put = vi.fn<StoragePort['put']>(() => Promise.resolve());
  const remove = vi.fn<StoragePort['delete']>(() => Promise.resolve());
  const get = vi.fn(() => Promise.resolve(options.body === undefined ? null : options.body));
  const storage = { get, put, delete: remove } as unknown as StoragePort;

  const queue = options.queue ?? createInlineQueue();
  const processor = createMediaProcessor({ prisma, storage, queue });
  return { processor, updateMany, put, remove, get, queue };
}

describe('hasVariants', () => {
  it('is true only for a map with at least one width', () => {
    expect(hasVariants({ '320': 'a' })).toBe(true);
    expect(hasVariants({})).toBe(false);
    expect(hasVariants(null)).toBe(false);
    expect(hasVariants('320')).toBe(false);
  });
});

describe('process', () => {
  it('writes every width beside the original and records them', async () => {
    const { processor, put, updateMany } = setup({ body: await jpeg() });

    await expect(processor.process(MEDIA_ID)).resolves.toBe('processed');

    expect(put.mock.calls.map(([key, , type]) => [key, type])).toEqual([
      [`${DIR}/320.webp`, 'image/webp'],
      [`${DIR}/640.webp`, 'image/webp'],
      [`${DIR}/1024.webp`, 'image/webp'],
      [`${DIR}/1600.webp`, 'image/webp'],
    ]);
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: MEDIA_ID, status: 'READY' },
      data: {
        width: 1200,
        height: 900,
        variants: {
          '320': `${DIR}/320.webp`,
          '640': `${DIR}/640.webp`,
          '1024': `${DIR}/1024.webp`,
          '1600': `${DIR}/1600.webp`,
        },
      },
    });
  });

  it.each([
    ['there is no such media', null],
    ['the upload was never committed', { status: 'PENDING' }],
    ['the image was removed', { status: 'ORPHAN' }],
    ['it is not a vehicle photograph', { ownerType: 'DEALER_PORTFOLIO' }],
    ['it was already processed', { variants: { '320': `${DIR}/320.webp` } }],
  ] as const)('leaves it alone when %s', async (_, media) => {
    const { processor, get, put, updateMany } = setup({ media, body: await jpeg() });

    await expect(processor.process(MEDIA_ID)).resolves.toBe('skipped');
    expect(get).not.toHaveBeenCalled();
    expect(put).not.toHaveBeenCalled();
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('gives up quietly when the original is missing from storage', async () => {
    const { processor, put, updateMany } = setup({ body: null });

    await expect(processor.process(MEDIA_ID)).resolves.toBe('unreadable');
    expect(put).not.toHaveBeenCalled();
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('keeps serving the original when the bytes cannot be decoded', async () => {
    const { processor, put, updateMany } = setup({ body: Buffer.from('not a photograph') });

    await expect(processor.process(MEDIA_ID)).resolves.toBe('unreadable');
    expect(put).not.toHaveBeenCalled();
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('deletes what it wrote when the image was removed while it worked', async () => {
    const { processor, put, remove } = setup({ body: await jpeg(), saved: 0 });

    await expect(processor.process(MEDIA_ID)).resolves.toBe('skipped');
    expect(put).toHaveBeenCalledTimes(4);
    expect(remove.mock.calls.map(([key]) => key)).toEqual([
      `${DIR}/320.webp`,
      `${DIR}/640.webp`,
      `${DIR}/1024.webp`,
      `${DIR}/1600.webp`,
    ]);
  });
});

describe('work', () => {
  it('processes the media a media.process job names', async () => {
    const { processor, queue, updateMany } = setup({ body: await jpeg() });
    await processor.work();

    await queue.send('media.process', { mediaId: MEDIA_ID });

    expect(updateMany).toHaveBeenCalledTimes(1);
  });

  it('ignores a job without a media id', async () => {
    const { processor, queue, get } = setup({ body: await jpeg() });
    await processor.work();

    await queue.send('media.process', { mediaId: 'not-a-uuid' });
    await queue.send('media.process', {});

    expect(get).not.toHaveBeenCalled();
  });
});

describe('request', () => {
  it('queues a media.process job for the media', async () => {
    const send = vi.fn(() => Promise.resolve());
    const { processor } = setup({ queue: { send } as unknown as Queue });

    await processor.request(MEDIA_ID);

    expect(send).toHaveBeenCalledWith('media.process', { mediaId: MEDIA_ID });
  });

  it('never fails the upload that asked, when the queue is unavailable', async () => {
    const queue = { send: () => Promise.reject(new Error('queue down')) } as unknown as Queue;
    const { processor } = setup({ queue });

    await expect(processor.request(MEDIA_ID)).resolves.toBeUndefined();
  });
});
