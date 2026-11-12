import { AdminListingDetail, VehiclePhotoParam } from '@dealers-drive/contracts';
import { NextResponse } from 'next/server';

import { apiGetParsed } from '@/lib/api';
import { problemResponse } from '@/lib/bff';

const NOT_FOUND = { error: 'That photograph is not on this listing.' } as const;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; mediaId: string }> },
): Promise<NextResponse> {
  const parsed = VehiclePhotoParam.safeParse(await params);
  if (!parsed.success) return NextResponse.json(NOT_FOUND, { status: 400 });

  try {
    const detail = await apiGetParsed(
      AdminListingDetail,
      `/v1/admin/listings/${encodeURIComponent(parsed.data.id)}`,
      { revalidate: false },
    );
    const photo = detail.submittedPhotos?.items.find(
      (item) => item.mediaId === parsed.data.mediaId,
    );
    if (!photo) return NextResponse.json(NOT_FOUND, { status: 404 });

    const upstream = await fetch(photo.url, { cache: 'no-store' });
    if (!upstream.ok || !upstream.body) return NextResponse.json(NOT_FOUND, { status: 404 });

    return new NextResponse(upstream.body, {
      status: 200,
      headers: {
        'Content-Type': photo.mimeType,
        'Content-Disposition': `attachment; filename="${photo.downloadName}"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    return problemResponse(error, '/api/admin/listings/[id]/submitted-photos/[mediaId]');
  }
}
