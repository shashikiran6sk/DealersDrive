import type { RouteRegistrar } from '../../../http/route.js';
import type { StoragePort } from '../../../platform/storage/storage.port.js';
import type { MediaService } from '../media.service.js';

export type MediaRoute = RouteRegistrar<{ service: MediaService }>;
export type StorageRoute = RouteRegistrar<{ storage: StoragePort; service: MediaService }>;
