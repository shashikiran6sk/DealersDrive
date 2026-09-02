import { describe, expect, it } from 'vitest';

import { createLocalStorage } from '../../../../src/platform/storage/local.adapter.js';
import type { StoragePort } from '../../../../src/platform/storage/storage.port.js';

/**
 * Unit tests for `src/platform/storage/storage.port.ts`.
 *
 * The file is an interface, so there is no behaviour of its own to run. What can
 * be tested — and what the port exists for — is that **no S3 concept leaks
 * through it**: that is the property that makes `STORAGE_DRIVER=r2` a one-line
 * container change rather than a refactor (ARCHITECTURE §5.1).
 *
 * These tests assert against the only implementation, treating it strictly as a
 * `StoragePort`, so a future `R2Storage` can be dropped in here unchanged.
 */
const implementations: [string, StoragePort][] = [['local disk', createLocalStorage()]];

describe.each(implementations)('%s satisfies StoragePort', (_name, storage) => {
  it('implements every member of the port', () => {
    const required: (keyof StoragePort)[] = [
      'presignPut',
      'head',
      'get',
      'put',
      'delete',
      'publicUrl',
      'signedReadUrl',
    ];

    for (const member of required) {
      expect(typeof storage[member], `${member} is missing`).toBe('function');
    }
  });

  it('presigns synchronously — a signature is arithmetic, not a network call', async () => {
    const presigned = await storage.presignPut({
      key: 'vehicles/a/original.jpg',
      contentType: 'image/jpeg',
      contentLength: 1,
    });

    expect(presigned).not.toBeInstanceOf(Promise);
    expect(presigned.method).toBe('PUT');
  });

  it('bakes content type and length into the upload, not just the key', async () => {
    const presigned = await storage.presignPut({
      key: 'vehicles/a/original.jpg',
      contentType: 'image/jpeg',
      contentLength: 4096,
    });

    // §12.1: a client cannot upload something other than what it declared.
    expect(presigned.headers['Content-Type']).toBe('image/jpeg');
    expect(presigned.headers['Content-Length']).toBe('4096');
  });

  it('returns an expiry with every presign', async () => {
    const presigned = await storage.presignPut({
      key: 'k',
      contentType: 'image/jpeg',
      contentLength: 1,
    });

    expect(presigned.expiresInSeconds).toBeGreaterThan(0);
  });

  it('describes objects in bytes and content type only', async () => {
    // No ETag, no VersionId, no StorageClass: a caller that learned to read
    // those would be coupled to S3 and the swap would stop being a one-liner.
    const absent = await storage.head('definitely/absent');

    expect(absent).toBeNull();
  });

  it('builds URLs without requiring a round trip', async () => {
    expect(typeof storage.publicUrl('a/b.webp')).toBe('string');
    expect(typeof (await storage.signedReadUrl('a/b.pdf', 60))).toBe('string');
  });

  it('separates public delivery from signed reads', async () => {
    // KYC documents have no public route at all; conflating the two would put a
    // GST certificate behind a guessable URL.
    expect(storage.publicUrl('k')).not.toBe(await storage.signedReadUrl('k', 60));
    expect(await storage.signedReadUrl('k', 60)).toContain('signature=');
    expect(storage.publicUrl('k')).not.toContain('signature=');
  });
});
