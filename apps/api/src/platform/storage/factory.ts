import { env } from '../../config/env.js';
import { createLocalStorage } from './local.adapter.js';
import { createS3Storage } from './s3.adapter.js';
import type { StoragePort } from './storage.port.js';

/**
 * The storage provider, chosen by one variable.
 *
 * It lives here rather than in `container.ts` because the seed needs the same
 * decision: a seeded photo has to land wherever the API will look for it, and
 * a seed that always wrote to local disk would leave a MinIO-backed developer
 * with a catalogue of broken images (§12.1).
 *
 *   local  — the filesystem. No container needed; what the test suite uses.
 *   minio  — S3-compatible, on localhost:9000.
 *   r2     — S3-compatible, at Cloudflare. Production.
 */
export function createStorage(): StoragePort {
  return env.STORAGE_DRIVER === 'local' ? createLocalStorage() : createS3Storage();
}
