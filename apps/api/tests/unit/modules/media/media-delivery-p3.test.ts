import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { buildOpenApiDocument } from '../../../../src/docs/openapi.js';
import { createStorageRouter } from '../../../../src/modules/media/media.routes.js';
import type { MediaService } from '../../../../src/modules/media/media.service.js';
import { sign } from '../../../../src/platform/storage/local.adapter.js';
import type { StoragePort } from '../../../../src/platform/storage/storage.port.js';

/**
 * Two P3 media-delivery findings from certification.
 *
 * BUG-NEW-008. The local private-read stand-in typed its answer from the key's
 * extension, and KYC keys have none, so a signed read of a PDF said
 * `image/jpeg`. The browser then refused to render the document a moderator
 * had opened. The bytes say what they are.
 *
 * BUG-NEW-011. The reference said only 320, 640, 1024 and 1600 were served and
 * anything else was a 404; the route accepts any width from 1 to 4000 and
 * answers with the best derivative it has. The reference now says that.
 */

function storageWith(body: Buffer) {
  return {
    presignPut: vi.fn(),
    head: vi.fn(),
    get: vi.fn().mockResolvedValue(body),
    put: vi.fn(),
    delete: vi.fn(),
    publicUrl: vi.fn(),
    signedReadUrl: vi.fn(),
  } satisfies StoragePort;
}

function signedRead(key: string) {
  const expiresAt = Date.now() + 60_000;
  const signature = sign({ key, contentType: 'read', contentLength: 0, expiresAt });
  return `/private?${new URLSearchParams({ key, expiresAt: String(expiresAt), signature }).toString()}`;
}

describe('BUG-NEW-008 — a local signed read is typed by its bytes', () => {
  it.each([
    ['a PDF', Buffer.from('%PDF-1.4\n%fixture'), 'application/pdf'],
    ['a PNG', Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]), 'image/png'],
    ['a JPEG', Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00]), 'image/jpeg'],
    ['a WebP', Buffer.from('RIFF\u0000\u0000\u0000\u0000WEBPVP8 ', 'latin1'), 'image/webp'],
  ])('serves %s KYC document under its own type', async (_label, body, type) => {
    const app = express();
    app.use(createStorageRouter(storageWith(body), {} as MediaService, 'local'));

    const res = await request(app).get(
      signedRead('dealers/fixture/documents/PAN_CARD/7f3c9a21-4444-4000-8000-000000000004'),
    );

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain(type);
  });
});

describe('BUG-NEW-011 — the derivative reference matches the widths the route serves', () => {
  it('documents the accepted width range rather than a fixed list', () => {
    const document = buildOpenApiDocument() as {
      paths: Record<string, Record<string, { description?: string }>>;
    };
    const description = document.paths['/media/by-media/{mediaId}/{width}.webp']?.get?.description;

    expect(description).toBeDefined();
    expect(description).not.toMatch(/anything else is a 404/);
    expect(description).toMatch(/1 to 4000/);
  });
});
