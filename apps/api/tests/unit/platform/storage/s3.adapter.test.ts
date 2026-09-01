import { describe, expect, it, vi } from 'vitest';

import { env } from '../../../../src/config/env.js';

/**
 * The MinIO/R2 adapter — the *same* adapter, which is the claim under test.
 *
 * The suite runs `STORAGE_DRIVER=local`, so this file builds the S3 adapter
 * directly with a stubbed client. What it pins is the contract every caller
 * depends on: a presigned PUT that binds content-type and content-length, a
 * `head`/`get` that answer null for a missing object rather than throwing, and
 * delivery through `MEDIA_BASE_URL` rather than the bucket.
 *
 * Nothing here reaches a network. The end-to-end proof that this speaks real S3
 * is a live MinIO round trip, documented in the README.
 */
const { createS3Storage, ensureBucket, createS3Client } =
  await import('../../../../src/platform/storage/s3.adapter.js');

interface Sent {
  name: string;
  input: Record<string, unknown>;
}

/** A client that records the commands it was asked to send. */
function fakeClient(reply: (command: Sent) => unknown = () => ({})) {
  const sent: Sent[] = [];

  const client = {
    sent,
    send: vi.fn((command: { constructor: { name: string }; input: Record<string, unknown> }) => {
      const entry = { name: command.constructor.name, input: command.input };
      sent.push(entry);
      const result = reply(entry);
      return result instanceof Error ? Promise.reject(result) : Promise.resolve(result);
    }),
    config: { credentials: () => Promise.resolve({ accessKeyId: 'k', secretAccessKey: 's' }) },
  };

  return client as unknown as Parameters<typeof createS3Storage>[0] & { sent: Sent[] };
}

function notFound(): Error {
  return Object.assign(new Error('not found'), {
    name: 'NotFound',
    $metadata: { httpStatusCode: 404 },
  });
}

/**
 * Signing is arithmetic, not a request: a real client is used for the URL tests
 * because the presigner reads its resolved config, and none of it touches the
 * network. The recording fake is for the calls that would.
 */
const signing = createS3Storage(createS3Client());

describe('presignPut', () => {
  it('signs a PUT to the configured bucket and key', async () => {
    const storage = signing;

    const presigned = await storage.presignPut({
      key: 'vehicles/abc/original.jpg',
      contentType: 'image/jpeg',
      contentLength: 2048,
    });

    const url = new URL(presigned.uploadUrl);
    expect(presigned.method).toBe('PUT');
    expect(url.pathname).toContain('vehicles/abc/original.jpg');
    expect(url.searchParams.get('X-Amz-Algorithm')).toBe('AWS4-HMAC-SHA256');
  });

  /**
   * The two signed headers are the enforcement, not a hint: a client that asks
   * to upload 2KB of JPEG and then sends 40MB of something else is refused by
   * the object store before a byte is stored, which is what lets the commit
   * step trust what it finds (§12.1).
   */
  it('binds the content type and length into the signature', async () => {
    const storage = signing;

    const presigned = await storage.presignPut({
      key: 'k',
      contentType: 'application/pdf',
      contentLength: 4096,
    });

    const signed = new URL(presigned.uploadUrl).searchParams.get('X-Amz-SignedHeaders') ?? '';
    expect(signed).toContain('content-length');
    expect(signed).toContain('content-type');
    expect(presigned.headers).toEqual({
      'Content-Type': 'application/pdf',
      'Content-Length': '4096',
    });
  });

  it('defaults the expiry to five minutes and honours an explicit one', async () => {
    const storage = signing;

    const standard = await storage.presignPut({
      key: 'k',
      contentType: 'image/jpeg',
      contentLength: 1,
    });
    const short = await storage.presignPut({
      key: 'k',
      contentType: 'image/jpeg',
      contentLength: 1,
      expiresInSeconds: 30,
    });

    expect(standard.expiresInSeconds).toBe(300);
    expect(new URL(standard.uploadUrl).searchParams.get('X-Amz-Expires')).toBe('300');
    expect(new URL(short.uploadUrl).searchParams.get('X-Amz-Expires')).toBe('30');
  });
});

describe('reading and writing', () => {
  it('reports size and type from a HEAD', async () => {
    const storage = createS3Storage(
      fakeClient(() => ({ ContentLength: 1234, ContentType: 'image/webp' })),
    );

    expect(await storage.head('k')).toEqual({ bytes: 1234, contentType: 'image/webp' });
  });

  /** A missing object is an absence, not a failure — callers branch on null. */
  it('answers null for an object that is not there', async () => {
    const storage = createS3Storage(fakeClient(() => notFound()));

    expect(await storage.head('missing')).toBeNull();
    expect(await storage.get('missing')).toBeNull();
  });

  it('lets a real failure through rather than hiding it as absence', async () => {
    const storage = createS3Storage(
      fakeClient(() =>
        Object.assign(new Error('access denied'), {
          name: 'AccessDenied',
          $metadata: { httpStatusCode: 403 },
        }),
      ),
    );

    await expect(storage.head('k')).rejects.toThrow('access denied');
    await expect(storage.get('k')).rejects.toThrow('access denied');
  });

  it('returns the bytes of an object that is there', async () => {
    const storage = createS3Storage(
      fakeClient(() => ({
        Body: { transformToByteArray: () => Promise.resolve(new Uint8Array([1, 2, 3])) },
      })),
    );

    expect(await storage.get('k')).toEqual(Buffer.from([1, 2, 3]));
  });

  it('answers null for a response with no body', async () => {
    expect(await createS3Storage(fakeClient(() => ({}))).get('k')).toBeNull();
  });

  it('puts the bytes with their content type', async () => {
    const client = fakeClient();
    await createS3Storage(client).put('k', Buffer.from('hello'), 'image/webp');

    expect(client.sent[0]?.name).toBe('PutObjectCommand');
    expect(client.sent[0]?.input).toMatchObject({
      Bucket: env.S3_BUCKET,
      Key: 'k',
      ContentType: 'image/webp',
    });
  });

  it('deletes by key', async () => {
    const client = fakeClient();
    await createS3Storage(client).delete('k');

    expect(client.sent[0]?.name).toBe('DeleteObjectCommand');
    expect(client.sent[0]?.input).toMatchObject({ Key: 'k' });
  });
});

describe('URLs', () => {
  /**
   * Delivery never addresses the bucket. The bucket is private in every
   * environment; locally the API serves the bytes and in production a
   * Cloudflare zone sits in front of R2.
   */
  it('serves public media through MEDIA_BASE_URL, not the endpoint', async () => {
    const storage = createS3Storage(fakeClient());

    const url = storage.publicUrl('vehicles/by-media/abc/640.webp');

    expect(url).toBe(`${env.MEDIA_BASE_URL}/vehicles/by-media/abc/640.webp`);
    expect(url).not.toContain(env.S3_ENDPOINT);
  });

  it('signs a private read with an expiry', async () => {
    const storage = signing;

    const url = new URL(await storage.signedReadUrl('kyc/dealer/GST/1', 300));

    expect(url.pathname).toContain('kyc/dealer/GST/1');
    expect(url.searchParams.get('X-Amz-Expires')).toBe('300');
    expect(url.searchParams.get('X-Amz-Signature')).toBeTruthy();
  });
});

describe('the bucket', () => {
  it('is left alone when it already exists', async () => {
    const client = fakeClient();

    await ensureBucket(client);

    expect(client.sent.map((command) => command.name)).toEqual(['HeadBucketCommand']);
  });

  /** A fresh MinIO volume has no bucket, and the first upload should not be how you find out. */
  it('is created when it does not', async () => {
    const client = fakeClient((command) =>
      command.name === 'HeadBucketCommand' ? notFound() : {},
    );

    await ensureBucket(client);

    expect(client.sent.map((command) => command.name)).toEqual([
      'HeadBucketCommand',
      'CreateBucketCommand',
    ]);
  });
});

describe('the client', () => {
  it('is built from the S3_* variables, path-style for MinIO', () => {
    const client = createS3Client();

    expect(client.config.forcePathStyle).toBe(env.S3_FORCE_PATH_STYLE);
  });
});
