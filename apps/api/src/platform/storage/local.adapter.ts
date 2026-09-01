import { createHmac, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';

import { env } from '../../config/env.js';
import type { PresignedUpload, StoragePort, StoredObject } from './storage.port.js';

/**
 * R2 stood in with the local filesystem.
 *
 * The point is that the *contract* is identical: the client receives a signed
 * URL with an expiry and content conditions, PUTs the bytes there without the
 * API in the path, and then commits. Only the host that terminates the PUT
 * changes when `STORAGE_DRIVER=r2` — which is the whole reason `StoragePort`
 * exists (ARCHITECTURE §12.1).
 */
export interface LocalStorageSignature {
  key: string;
  contentType: string;
  contentLength: number;
  expiresAt: number;
}

const ROOT = resolve(process.cwd(), env.STORAGE_LOCAL_DIR);

export function createLocalStorage(): StoragePort {
  return {
    // Not `async`: signing against local disk is arithmetic. The port is
    // promise-returning because signing against S3 is not.
    presignPut({
      key,
      contentType,
      contentLength,
      expiresInSeconds = 300,
    }): Promise<PresignedUpload> {
      const expiresAt = Date.now() + expiresInSeconds * 1000;
      const signature = sign({ key, contentType, contentLength, expiresAt });
      const params = new URLSearchParams({
        key,
        contentType,
        contentLength: String(contentLength),
        expiresAt: String(expiresAt),
        signature,
      });

      return Promise.resolve({
        uploadUrl: `${env.API_BASE_URL}/uploads?${params.toString()}`,
        method: 'PUT' as const,
        headers: {
          'Content-Type': contentType,
          'Content-Length': String(contentLength),
        },
        expiresInSeconds,
      });
    },

    async head(key) {
      try {
        const info = await stat(pathFor(key));
        return { bytes: info.size, contentType: contentTypeOf(key) } satisfies StoredObject;
      } catch {
        return null;
      }
    },

    async get(key) {
      try {
        return await readFile(pathFor(key));
      } catch {
        return null;
      }
    },

    async put(key, body) {
      const target = pathFor(key);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, body);
    },

    async delete(key) {
      await rm(pathFor(key), { force: true });
    },

    publicUrl(key) {
      return `${env.MEDIA_BASE_URL}/${key}`;
    },

    signedReadUrl(key, expiresInSeconds) {
      const expiresAt = Date.now() + expiresInSeconds * 1000;
      const signature = sign({ key, contentType: 'read', contentLength: 0, expiresAt });
      const params = new URLSearchParams({ expiresAt: String(expiresAt), signature });
      return Promise.resolve(`${env.API_BASE_URL}/private/${key}?${params.toString()}`);
    },
  };
}

export function sign(input: LocalStorageSignature): string {
  return createHmac('sha256', env.UPLOAD_SIGNING_SECRET)
    .update(`${input.key}\n${input.contentType}\n${input.contentLength}\n${input.expiresAt}`)
    .digest('hex');
}

export function verifySignature(input: LocalStorageSignature, candidate: string): boolean {
  if (input.expiresAt < Date.now()) return false;
  const expected = Buffer.from(sign(input));
  const actual = Buffer.from(candidate);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/**
 * `..` in a storage key would escape the root. Keys are always generated
 * server-side, but the one function that turns a key into a filesystem path is
 * the wrong place to assume that.
 */
export function pathFor(key: string): string {
  const target = resolve(ROOT, key);
  if (target !== ROOT && !target.startsWith(ROOT + sep)) {
    throw new Error(`Storage key escapes the storage root: ${key}`);
  }
  return target;
}

export function storageRoot(): string {
  return ROOT;
}

export function contentTypeOf(key: string): string {
  if (key.endsWith('.webp')) return 'image/webp';
  if (key.endsWith('.png')) return 'image/png';
  if (key.endsWith('.pdf')) return 'application/pdf';
  return 'image/jpeg';
}

export function joinKey(...parts: string[]): string {
  return parts.filter(Boolean).join('/').replaceAll(sep, '/').replace(/\/+/g, '/');
}

export { join as joinPath };
