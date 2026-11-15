import { DealerPhotoPresignInput, IdParam, type PresignResponse } from '@dealers-drive/contracts';
import { NextResponse } from 'next/server';

import { apiSend } from '@/lib/api';
import { problemResponse } from '@/lib/bff';

import { PHOTOS_BFF_TEXT, vehiclePhotosPath } from '../photos.constants';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const vehicle = IdParam.safeParse(await params);
  const body = DealerPhotoPresignInput.safeParse(await request.json().catch(() => null));
  if (!vehicle.success || !body.success) {
    return NextResponse.json({ error: PHOTOS_BFF_TEXT.cannotUpload }, { status: 400 });
  }
  try {
    const result = await apiSend<PresignResponse>(
      'POST',
      `${vehiclePhotosPath(vehicle.data.id)}/photos/presign`,
      body.data,
    );
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return problemResponse(error, '/api/dealer/vehicles/[id]/photos/presign');
  }
}
