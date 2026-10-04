import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { createStorageRouter } from '../../../../src/modules/media/media.routes.js';
import type { MediaService } from '../../../../src/modules/media/media.service.js';
import { sign } from '../../../../src/platform/storage/local.adapter.js';
import type { StoragePort } from '../../../../src/platform/storage/storage.port.js';

/**
 * SEC-DISC-001 / ORIG-BUG-001. `PUT /uploads` and `GET /private` are the local
 * stand-ins for an S3 presigned PUT and GET. Their only authority is an HMAC
 * keyed by `UPLOAD_SIGNING_SECRET`, whose default is committed. Behind an S3
 * driver (minio, r2) the adapter issues real presigned URLs, so the stand-ins
 * have no caller — and if mounted they forward a forged request straight to
 * the bucket. They must exist only for the local driver.
 */

function storagePort() {
  return {
    presignPut: vi.fn(),
    head: vi.fn(),
    get: vi.fn().mockResolvedValue(Buffer.from('%PDF-1.4 private')),
    put: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn(),
    publicUrl: vi.fn(),
    signedReadUrl: vi.fn(),
  } satisfies StoragePort;
}

function forgedUpload(key: string, body: Buffer) {
  const expiresAt = Date.now() + 60_000;
  const contentType = 'image/jpeg';
  const signature = sign({ key, contentType, contentLength: body.length, expiresAt });
  return `/uploads?${new URLSearchParams({ key, contentType, contentLength: String(body.length), expiresAt: String(expiresAt), signature }).toString()}`;
}

function forgedRead(key: string) {
  const expiresAt = Date.now() + 60_000;
  const signature = sign({ key, contentType: 'read', contentLength: 0, expiresAt });
  return `/private?${new URLSearchParams({ key, expiresAt: String(expiresAt), signature }).toString()}`;
}

function appWith(driver: 'local' | 'minio' | 'r2', storage: StoragePort) {
  const app = express();
  app.use(createStorageRouter(storage, {} as MediaService, driver));
  return app;
}

describe.each(['minio', 'r2'] as const)('behind the %s driver', (driver) => {
  it('does not mount the upload stand-in: a forged PUT never reaches the bucket', async () => {
    const storage = storagePort();
    const body = Buffer.from('forged bytes');
    const key = 'dealers/victim/documents/PAN_CARD/forged';

    const res = await request(appWith(driver, storage))
      .put(forgedUpload(key, body))
      .set('content-type', 'image/jpeg')
      .send(body);

    expect(res.status).toBe(404);
    expect(storage.put).not.toHaveBeenCalled();
  });

  it('does not mount the private-read stand-in: a forged GET never reads the bucket', async () => {
    const storage = storagePort();

    const res = await request(appWith(driver, storage)).get(
      forgedRead('dealers/victim/documents/PAN_CARD/doc'),
    );

    expect(res.status).toBe(404);
    expect(storage.get).not.toHaveBeenCalled();
  });
});

describe('behind the local driver', () => {
  it('keeps the stand-ins, which are the only upload path a local deployment has', async () => {
    const storage = storagePort();
    const body = Buffer.from('local bytes');

    const res = await request(appWith('local', storage))
      .put(forgedUpload('vehicles/local/original.jpg', body))
      .set('content-type', 'image/jpeg')
      .send(body);

    expect(res.status).toBe(200);
    expect(storage.put).toHaveBeenCalledOnce();
  });
});
