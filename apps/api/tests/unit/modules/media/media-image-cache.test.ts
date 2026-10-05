import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { errorHandler } from '../../../../src/middleware/error-handler.js';
import { imageEtag, type LocatedImage } from '../../../../src/modules/media/media.service.js';
import { getMediaImage } from '../../../../src/modules/media/routes/get-media-image.js';
import { matchesEtag } from '../../../../src/modules/media/routes/if-none-match.js';

/**
 * R108 — public images are revalidated, not re-downloaded.
 *
 * The route used to answer every view with `no-store`, so a browser never kept
 * an image and every gallery view streamed it from S3 through the API again.
 * It now answers `no-cache` with a strong ETag derived from the media id and
 * the object key (an object under a key never changes: the key embeds the
 * media id). A revalidation runs the full visibility check and, when the image
 * is still public and unchanged, answers 304 without touching storage.
 */

const MEDIA_ID = '7d3c1b52-0f4a-4b8e-9a51-6c2f0d9e1a11';
const PATH = `/media/by-media/${MEDIA_ID}/640.webp`;
const KEY = `vehicles/v-1/${MEDIA_ID}/640.webp`;

function app(located: LocatedImage | null, body: Buffer | null = Buffer.from('webp-bytes')) {
  const service = {
    locate: vi.fn(() => Promise.resolve(located)),
    read: vi.fn(() => Promise.resolve(body)),
  };
  const router = express.Router();
  getMediaImage(router, { service, storage: {} } as never);
  const server = express();
  server.use(router);
  server.use(errorHandler);
  return { server, service };
}

const visible: LocatedImage = {
  key: KEY,
  contentType: 'image/webp',
  etag: imageEtag(MEDIA_ID, KEY),
};

describe('GET /media/by-media/:mediaId/:width.webp', () => {
  it('serves a visible image with no-cache and a strong ETag', async () => {
    const { server } = app(visible);

    const response = await request(server).get(PATH).expect(200);

    expect(response.headers['cache-control']).toBe('no-cache');
    expect(response.headers.etag).toBe(visible.etag);
    expect(response.headers.etag).not.toMatch(/^W\//);
  });

  it('answers a matching revalidation with 304 and never reads storage', async () => {
    const { server, service } = app(visible);

    const response = await request(server).get(PATH).set('If-None-Match', visible.etag);

    expect(response.status).toBe(304);
    expect(response.headers['cache-control']).toBe('no-cache');
    expect(service.locate).toHaveBeenCalledOnce();
    expect(service.read).not.toHaveBeenCalled();
  });

  it('serves the bytes again when the ETag does not match', async () => {
    const { server, service } = app(visible);

    await request(server).get(PATH).set('If-None-Match', '"m1-stale"').expect(200);

    expect(service.read).toHaveBeenCalledOnce();
  });

  /** The visibility check runs before any validator is compared. */
  it('refuses a revalidation for an image that is no longer public, uncacheably', async () => {
    const { server, service } = app(null);

    const response = await request(server).get(PATH).set('If-None-Match', visible.etag);

    expect(response.status).toBe(404);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.headers.etag).not.toBe(visible.etag);
    expect(service.read).not.toHaveBeenCalled();
  });

  it('refuses, uncacheably and without the image ETag, when the bytes are gone', async () => {
    const { server } = app(visible, null);

    const response = await request(server).get(PATH).expect(404);

    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.headers.etag).not.toBe(visible.etag);
  });
});

describe('imageEtag', () => {
  it('is stable for one object and differs between widths and media', () => {
    expect(imageEtag(MEDIA_ID, KEY)).toBe(imageEtag(MEDIA_ID, KEY));
    expect(imageEtag(MEDIA_ID, KEY)).not.toBe(imageEtag(MEDIA_ID, KEY.replace('640', '1024')));
    expect(imageEtag(MEDIA_ID, KEY)).not.toBe(imageEtag('another-media', KEY));
  });
});

describe('matchesEtag', () => {
  const etag = '"m1-abc"';

  it.each([
    ['the same tag', '"m1-abc"', true],
    ['the weak form of it', 'W/"m1-abc"', true],
    ['it within a list', '"other", "m1-abc"', true],
    ['a wildcard', '*', true],
    ['another tag', '"m1-xyz"', false],
    ['nothing', undefined, false],
  ])('%s → %s', (_label, header, expected) => {
    expect(matchesEtag(header, etag)).toBe(expected);
  });
});
