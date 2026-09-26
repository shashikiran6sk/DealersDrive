import type { AdminVehicleImage } from '@dealers-drive/contracts';

import type { ImageRow } from './vehicle-images.repository.js';

export function toAdminVehicleImage(row: ImageRow, url: string): AdminVehicleImage {
  return {
    mediaId: row.mediaId,
    position: row.position,
    isPrimary: row.isPrimary,
    url,
    fileName: row.media.fileName,
    mimeType: row.media.mimeType,
    bytes: row.media.bytes,
    width: row.media.width,
    height: row.media.height,
    uploadedAt: row.createdAt.toISOString(),
  };
}
