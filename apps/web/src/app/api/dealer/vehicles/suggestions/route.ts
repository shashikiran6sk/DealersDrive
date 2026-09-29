import { VehicleSuggestQuery, type VehicleSuggestions } from '@dealers-drive/contracts';
import { NextResponse, type NextRequest } from 'next/server';

import { apiGet, qs } from '@/lib/api';
import { problemResponse } from '@/lib/bff';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const parsed = VehicleSuggestQuery.safeParse(
    Object.fromEntries(request.nextUrl.searchParams.entries()),
  );
  if (!parsed.success) {
    return NextResponse.json({ field: 'make', values: [] }, { status: 400 });
  }

  try {
    const payload = await apiGet<VehicleSuggestions>(
      `/v1/dealer/vehicles/suggestions${qs(parsed.data)}`,
      { revalidate: false },
    );
    return NextResponse.json(payload, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return problemResponse(error, '/api/dealer/vehicles/suggestions');
  }
}
