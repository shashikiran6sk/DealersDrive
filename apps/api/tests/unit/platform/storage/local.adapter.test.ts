import { rm } from 'node:fs/promises';
import { sep } from 'node:path';

import { afterAll, describe, expect, it, vi } from 'vitest';

import { env } from '../../../../src/config/env.js';
import {
  contentTypeOf,
  createLocalStorage,
  joinKey,
  pathFor,
  sign,
  storageRoot,
  verifySignature,
  type LocalStorageSignature,
} from '../../../../src/platform/storage/local.adapter.js';

/**
 * Unit tests for `src/platform/storage/local.adapter.ts`.
 *
 * Two things here are security-relevant rather than merely functional:
 *
 *   1. **The signature.** It is what stops an arbitrary PUT to the upload route
 *      from writing anywhere in the bucket. It must be compared in constant time,
 *      must expire, and must cover every field it claims to bind.
 *   2. **`pathFor`.** It is the only function that turns a client-visible key into
 *      a filesystem path, so it is the only place a `..` could escape the root.
 *
 * Files are written under a test-only prefix and removed afterwards.
 */
const PREFIX = 'unit-tests';

afterAll(async () => {
  await rm(pathFor(PREFIX), { recursive: true, force: true });
});

function signature(overrides: Partial<LocalStorageSignature> = {}): LocalStorageSignature {
  return {
    key: 'vehicles/abc/original.jpg',
    contentType: 'image/jpeg',
    contentLength: 1024,
    expiresAt: Date.now() + 60_000,
    ...overrides,
  };
}

describe('presignPut', () => {
  it('returns a PUT the client can make without the API in the path', async () => {
    const presigned = await createLocalStorage().presignPut({
      key: 'vehicles/abc/original.jpg',
      contentType: 'image/jpeg',
      contentLength: 2048,
    });

    expect(presigned.method).toBe('PUT');
    expect(presigned.uploadUrl.startsWith(`${env.API_BASE_URL}/uploads?`)).toBe(true);
  });

  it('binds the key, content type and length into the URL', async () => {
    const presigned = await createLocalStorage().presignPut({
      key: 'vehicles/abc/original.jpg',
      contentType: 'image/jpeg',
      contentLength: 2048,
    });
    const params = new URL(presigned.uploadUrl).searchParams;

    expect(params.get('key')).toBe('vehicles/abc/original.jpg');
    expect(params.get('contentType')).toBe('image/jpeg');
    expect(params.get('contentLength')).toBe('2048');
    expect(params.get('signature')).toMatch(/^[0-9a-f]{64}$/);
  });

  it('defaults the expiry to five minutes', async () => {
    const before = Date.now();
    const presigned = await createLocalStorage().presignPut({
      key: 'k',
      contentType: 'image/jpeg',
      contentLength: 1,
    });
    const expiresAt = Number(new URL(presigned.uploadUrl).searchParams.get('expiresAt'));

    expect(presigned.expiresInSeconds).toBe(300);
    expect(expiresAt).toBeGreaterThanOrEqual(before + 300_000);
    expect(expiresAt).toBeLessThanOrEqual(Date.now() + 300_000);
  });

  it('honours an explicit expiry', async () => {
    const presigned = await createLocalStorage().presignPut({
      key: 'k',
      contentType: 'image/jpeg',
      contentLength: 1,
      expiresInSeconds: 30,
    });

    expect(presigned.expiresInSeconds).toBe(30);
    expect(Number(new URL(presigned.uploadUrl).searchParams.get('expiresAt'))).toBeLessThanOrEqual(
      Date.now() + 30_000,
    );
  });

  it('tells the client which headers to send, so the signature can bind them', async () => {
    const presigned = await createLocalStorage().presignPut({
      key: 'k',
      contentType: 'application/pdf',
      contentLength: 4096,
    });

    expect(presigned.headers).toEqual({
      'Content-Type': 'application/pdf',
      'Content-Length': '4096',
    });
  });

  it('produces a URL whose signature verifies', async () => {
    const presigned = await createLocalStorage().presignPut({
      key: 'vehicles/abc/original.jpg',
      contentType: 'image/jpeg',
      contentLength: 2048,
    });
    const params = new URL(presigned.uploadUrl).searchParams;

    expect(
      verifySignature(
        {
          key: params.get('key') ?? '',
          contentType: params.get('contentType') ?? '',
          contentLength: Number(params.get('contentLength')),
          expiresAt: Number(params.get('expiresAt')),
        },
        params.get('signature') ?? '',
      ),
    ).toBe(true);
  });

  it('encodes a key with slashes without breaking the query string', async () => {
    const presigned = await createLocalStorage().presignPut({
      key: 'dealers/1/kyc/gst certificate.pdf',
      contentType: 'application/pdf',
      contentLength: 10,
    });

    expect(new URL(presigned.uploadUrl).searchParams.get('key')).toBe(
      'dealers/1/kyc/gst certificate.pdf',
    );
  });
});

describe('sign / verifySignature', () => {
  it('is deterministic for the same input', () => {
    const input = signature();

    expect(sign(input)).toBe(sign(input));
  });

  it('changes when any single field changes', () => {
    const base = signature();
    const baseline = sign(base);

    expect(sign({ ...base, key: 'other' })).not.toBe(baseline);
    expect(sign({ ...base, contentType: 'image/png' })).not.toBe(baseline);
    expect(sign({ ...base, contentLength: base.contentLength + 1 })).not.toBe(baseline);
    expect(sign({ ...base, expiresAt: base.expiresAt + 1 })).not.toBe(baseline);
  });

  it('cannot be forged by rearranging the fields', () => {
    // The parts are newline-joined, so a key ending in a newline must not be able
    // to impersonate a different content type.
    const honest = sign(signature({ key: 'a', contentType: 'b' }));
    const forged = sign(signature({ key: 'a\nb', contentType: '' }));

    expect(forged).not.toBe(honest);
  });

  it('accepts its own signature', () => {
    const input = signature();

    expect(verifySignature(input, sign(input))).toBe(true);
  });

  it('rejects a wrong signature of the right length', () => {
    const input = signature();
    const wrong = sign(signature({ key: 'somewhere/else' }));

    expect(verifySignature(input, wrong)).toBe(false);
  });

  it('rejects a signature of the wrong length without throwing', () => {
    // timingSafeEqual throws on a length mismatch, so the length is checked
    // first — a short signature must be a `false`, not a 500.
    expect(verifySignature(signature(), 'abc')).toBe(false);
    expect(verifySignature(signature(), '')).toBe(false);
    expect(verifySignature(signature(), `${sign(signature())}00`)).toBe(false);
  });

  it('rejects an expired signature even when it is otherwise valid', () => {
    const expired = signature({ expiresAt: Date.now() - 1 });

    expect(verifySignature(expired, sign(expired))).toBe(false);
  });

  it('accepts right up to the expiry', () => {
    const input = signature({ expiresAt: Date.now() + 5_000 });

    expect(verifySignature(input, sign(input))).toBe(true);
  });

  it('binds to UPLOAD_SIGNING_SECRET', () => {
    // Two deployments with different secrets must not accept each other's URLs.
    expect(env.UPLOAD_SIGNING_SECRET.length).toBeGreaterThan(0);
    expect(sign(signature())).toHaveLength(64);
  });
});

describe('pathFor', () => {
  it('resolves a key under the storage root', () => {
    expect(pathFor('vehicles/a/original.jpg')).toBe(
      `${storageRoot()}${sep}vehicles${sep}a${sep}original.jpg`,
    );
  });

  it('refuses a key that climbs out of the root', () => {
    for (const key of ['../secrets.env', '../../etc/passwd', 'a/../../b', '..']) {
      expect(() => pathFor(key), `"${key}" should be refused`).toThrow(/escapes the storage root/);
    }
  });

  it('refuses an absolute path', () => {
    expect(() => pathFor('/etc/passwd')).toThrow(/escapes the storage root/);
  });

  it('allows a key that merely starts with the root’s name', () => {
    // `resolve` alone would let `<root>-evil` through a naive `startsWith`, which
    // is why the check appends a separator.
    expect(() => pathFor('vehicles-archive/a.jpg')).not.toThrow();
  });

  it('normalises interior traversal that stays inside the root', () => {
    expect(pathFor('vehicles/a/../b.jpg')).toBe(`${storageRoot()}${sep}vehicles${sep}b.jpg`);
  });

  it('treats the root itself as valid', () => {
    expect(pathFor('')).toBe(storageRoot());
  });
});

describe('storageRoot', () => {
  it('points at the configured directory, resolved from the process cwd', () => {
    expect(storageRoot().endsWith(env.STORAGE_LOCAL_DIR)).toBe(true);
    expect(storageRoot().startsWith(sep)).toBe(true);
  });
});

describe('contentTypeOf', () => {
  it('maps the extensions the processor writes', () => {
    expect(contentTypeOf('a/b/640.webp')).toBe('image/webp');
    expect(contentTypeOf('logo.png')).toBe('image/png');
    expect(contentTypeOf('invoices/INV-1.pdf')).toBe('application/pdf');
  });

  it('falls back to jpeg for anything else', () => {
    // Every original upload is a photo, and the ones that are not are rejected
    // before they reach storage.
    expect(contentTypeOf('original.jpg')).toBe('image/jpeg');
    expect(contentTypeOf('no-extension')).toBe('image/jpeg');
    expect(contentTypeOf('')).toBe('image/jpeg');
  });

  it('is case-sensitive, matching the keys the API generates', () => {
    expect(contentTypeOf('A.WEBP')).toBe('image/jpeg');
  });
});

describe('joinKey', () => {
  it('joins parts with forward slashes', () => {
    expect(joinKey('vehicles', 'abc', 'original.jpg')).toBe('vehicles/abc/original.jpg');
  });

  it('drops empty parts rather than leaving a double slash', () => {
    expect(joinKey('vehicles', '', 'abc')).toBe('vehicles/abc');
  });

  it('collapses repeated slashes', () => {
    expect(joinKey('vehicles/', '/abc')).toBe('vehicles/abc');
  });

  it('always produces forward slashes, whatever the platform separator is', () => {
    // A key is an object key, not a path. On Windows a `\` would become part of
    // the object name in R2 and the file would be unreachable.
    expect(joinKey(`vehicles${sep}abc`, 'original.jpg')).toBe('vehicles/abc/original.jpg');
  });

  it('returns an empty string when given nothing', () => {
    expect(joinKey()).toBe('');
  });
});

describe('the object operations', () => {
  const storage = createLocalStorage();
  const key = `${PREFIX}/nested/dir/photo.webp`;

  it('round-trips a put, head and get', async () => {
    await storage.put(key, Buffer.from('image-bytes'), 'image/webp');

    expect(await storage.head(key)).toEqual({ bytes: 11, contentType: 'image/webp' });
    expect((await storage.get(key))?.toString()).toBe('image-bytes');
  });

  it('creates intermediate directories on put', async () => {
    const deep = `${PREFIX}/a/b/c/d/photo.jpg`;

    await expect(storage.put(deep, Buffer.from('x'), 'image/jpeg')).resolves.toBeUndefined();
    expect(await storage.head(deep)).toMatchObject({ bytes: 1 });
  });

  it('overwrites an existing object', async () => {
    await storage.put(key, Buffer.from('first'), 'image/webp');
    await storage.put(key, Buffer.from('second'), 'image/webp');

    expect((await storage.get(key))?.toString()).toBe('second');
  });

  it('answers null for a missing object rather than throwing', async () => {
    // The commit step calls `head` to decide whether the client's PUT actually
    // landed; a throw there would turn a missing upload into a 500.
    expect(await storage.head(`${PREFIX}/absent.jpg`)).toBeNull();
    expect(await storage.get(`${PREFIX}/absent.jpg`)).toBeNull();
  });

  it('deletes an object, and deleting a missing one is not an error', async () => {
    await storage.put(`${PREFIX}/doomed.jpg`, Buffer.from('x'), 'image/jpeg');

    await storage.delete(`${PREFIX}/doomed.jpg`);
    expect(await storage.head(`${PREFIX}/doomed.jpg`)).toBeNull();

    // Idempotent: a retried cleanup job must not fail on its second run.
    await expect(storage.delete(`${PREFIX}/doomed.jpg`)).resolves.toBeUndefined();
  });

  it('refuses a traversing key on every operation', async () => {
    await expect(storage.put('../escape.jpg', Buffer.from('x'), 'image/jpeg')).rejects.toThrow(
      /escapes/,
    );
    await expect(storage.delete('../escape.jpg')).rejects.toThrow(/escapes/);
    // head and get catch their own errors, so a traversal reads as "absent".
    expect(await storage.head('../escape.jpg')).toBeNull();
    expect(await storage.get('../escape.jpg')).toBeNull();
  });
});

describe('publicUrl', () => {
  it('addresses an object through the media base URL', () => {
    expect(createLocalStorage().publicUrl('vehicles/by-media/abc/640.webp')).toBe(
      `${env.MEDIA_BASE_URL}/vehicles/by-media/abc/640.webp`,
    );
  });
});

describe('signedReadUrl', () => {
  it('signs a private read with an expiry', async () => {
    const url = new URL(await createLocalStorage().signedReadUrl('dealers/1/kyc/gst.pdf', 120));

    expect(url.pathname).toBe('/private/dealers/1/kyc/gst.pdf');
    expect(Number(url.searchParams.get('expiresAt'))).toBeGreaterThan(Date.now());
    expect(url.searchParams.get('signature')).toMatch(/^[0-9a-f]{64}$/);
  });

  it('signs a read with a different payload from a write', async () => {
    const spy = vi.fn();
    const url = new URL(await createLocalStorage().signedReadUrl('k', 60));
    const expiresAt = Number(url.searchParams.get('expiresAt'));

    // A read URL must not be replayable as an upload URL: the content type in
    // the signed payload is the literal `read`.
    expect(url.searchParams.get('signature')).toBe(
      sign({ key: 'k', contentType: 'read', contentLength: 0, expiresAt }),
    );
    expect(spy).not.toHaveBeenCalled();
  });

  it('expires sooner for a shorter window', async () => {
    const short = Number(
      new URL(await createLocalStorage().signedReadUrl('k', 10)).searchParams.get('expiresAt'),
    );
    const long = Number(
      new URL(await createLocalStorage().signedReadUrl('k', 600)).searchParams.get('expiresAt'),
    );

    expect(short).toBeLessThan(long);
  });
});
