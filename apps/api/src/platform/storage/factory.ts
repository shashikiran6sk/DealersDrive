import { env } from '../../config/env.js';
import { createLocalStorage } from './local.adapter.js';
import { createS3Storage } from './s3.adapter.js';
import type { StoragePort } from './storage.port.js';

export function createStorage(): StoragePort {
  return env.STORAGE_DRIVER === 'local' ? createLocalStorage() : createS3Storage();
}
