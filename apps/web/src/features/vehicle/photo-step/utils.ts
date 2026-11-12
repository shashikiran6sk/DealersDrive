import {
  DealerVehiclePhotos,
  PresignResponse,
  type PhotoPlan,
  type VehiclePhotoSlot,
} from '@dealers-drive/contracts';

import { postJson, problemMessage, putToStorage, UploadFailure } from '@/lib/upload';

import {
  IMAGE_MAX_BYTES,
  PHOTO_MAX_EDGE,
  PHOTO_RESIZE_QUALITY,
  PHOTO_STEP_TEXT,
} from './photo-step.constants';

function base(vehicleId: string): string {
  return `/api/dealer/vehicles/${encodeURIComponent(vehicleId)}`;
}

async function parsed(response: Response, fallback: string): Promise<DealerVehiclePhotos> {
  if (!response.ok) throw new UploadFailure(await problemMessage(response, fallback));
  const result = DealerVehiclePhotos.safeParse(await response.json().catch(() => null));
  if (!result.success) throw new UploadFailure(fallback);
  return result.data;
}

export async function choosePlan(vehicleId: string, plan: PhotoPlan): Promise<DealerVehiclePhotos> {
  const response = await fetch(`${base(vehicleId)}/photo-plan`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ plan }),
  });
  return parsed(response, PHOTO_STEP_TEXT.planFailed);
}

export function scaledSize(width: number, height: number, maxEdge = PHOTO_MAX_EDGE) {
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

export async function fitForUpload(file: File): Promise<File> {
  if (file.size <= IMAGE_MAX_BYTES) return file;
  const bitmap = await createImageBitmap(file);
  const size = scaledSize(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, size.width, size.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, 'image/jpeg', PHOTO_RESIZE_QUALITY);
  });
  if (!blob || blob.size > IMAGE_MAX_BYTES) throw new UploadFailure(PHOTO_STEP_TEXT.tooLarge);
  return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
}

export async function uploadPhoto(
  vehicleId: string,
  slot: VehiclePhotoSlot,
  original: File,
): Promise<DealerVehiclePhotos> {
  const file = await fitForUpload(original);
  const started = await postJson(`${base(vehicleId)}/photos/presign`, {
    slot,
    fileName: file.name.slice(0, 160) || 'photo.jpg',
    mimeType: file.type,
    bytes: file.size,
  });
  if (!started.ok) throw new UploadFailure(await problemMessage(started, PHOTO_STEP_TEXT.failed));
  const signed = PresignResponse.safeParse(await started.json().catch(() => null));
  if (!signed.success || !signed.data.mediaId) throw new UploadFailure(PHOTO_STEP_TEXT.failed);
  await putToStorage(signed.data, file);
  const committed = await fetch(
    `${base(vehicleId)}/photos/${encodeURIComponent(signed.data.mediaId)}/commit`,
    { method: 'POST' },
  );
  return parsed(committed, PHOTO_STEP_TEXT.failed);
}

export async function removePhoto(
  vehicleId: string,
  mediaId: string,
): Promise<DealerVehiclePhotos> {
  const response = await fetch(`${base(vehicleId)}/photos/${encodeURIComponent(mediaId)}`, {
    method: 'DELETE',
  });
  return parsed(response, PHOTO_STEP_TEXT.failed);
}
