import { IdParam, SetPhotoPlanInput, type DealerVehiclePhotos } from '@dealers-drive/contracts';
import { NextResponse } from 'next/server';

import { apiSend } from '@/lib/api';
import { problemResponse } from '@/lib/bff';

import { PHOTOS_BFF_TEXT, vehiclePhotosPath } from '../photos/photos.constants';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const vehicle = IdParam.safeParse(await params);
  const body = SetPhotoPlanInput.safeParse(await request.json().catch(() => null));
  if (!vehicle.success || !body.success) {
    return NextResponse.json({ error: PHOTOS_BFF_TEXT.unknownVehicle }, { status: 400 });
  }
  try {
    const result = await apiSend<DealerVehiclePhotos>(
      'PUT',
      `${vehiclePhotosPath(vehicle.data.id)}/photo-plan`,
      body.data,
    );
    return NextResponse.json(result);
  } catch (error) {
    return problemResponse(error, '/api/dealer/vehicles/[id]/photo-plan');
  }
}
