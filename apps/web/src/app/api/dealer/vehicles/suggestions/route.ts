import { VehicleSuggestQuery, type VehicleSuggestions } from '@dealers-drive/contracts';
import { NextResponse, type NextRequest } from 'next/server';

import { ApiError, apiGet, qs } from '@/lib/api';

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
    if (error instanceof ApiError) {
      return NextResponse.json(error.problem, {
        status: error.status,
        headers: { 'Content-Type': 'application/problem+json' },
      });
    }
    return NextResponse.json({ error: 'Upstream unavailable.' }, { status: 502 });
  }
}
