import { VehiclePhotoParam, type DealerVehiclePhotos } from '@dealers-drive/contracts';
import { NextResponse } from 'next/server';

import { apiSend } from '@/lib/api';
import { problemResponse } from '@/lib/bff';

import { PHOTOS_BFF_TEXT, vehiclePhotosPath } from '../photos.constants';

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; mediaId: string }> },
): Promise<NextResponse> {
  const parsed = VehiclePhotoParam.safeParse(await params);
  if (!parsed.success) {
    return NextResponse.json({ error: PHOTOS_BFF_TEXT.unknownVehicle }, { status: 400 });
  }
  try {
    const result = await apiSend<DealerVehiclePhotos>(
      'DELETE',
      `${vehiclePhotosPath(parsed.data.id)}/photos/${encodeURIComponent(parsed.data.mediaId)}`,
    );
    return NextResponse.json(result);
  } catch (error) {
    return problemResponse(error, '/api/dealer/vehicles/[id]/photos/[mediaId]');
  }
}
