import 'server-only';

import { VehicleSuggestQuery, type VehicleSuggestions } from '@dealers-drive/contracts';
import { NextResponse, type NextRequest } from 'next/server';

import { apiGet, qs } from './api';
import { problemResponse } from './bff';

const NO_VALUES: VehicleSuggestions = { field: 'model', values: [] };

export async function proxyVehicleSuggestions(
  request: NextRequest,
  apiPath: string | null,
  route: string,
): Promise<NextResponse> {
  const parsed = VehicleSuggestQuery.safeParse(
    Object.fromEntries(request.nextUrl.searchParams.entries()),
  );
  if (!apiPath || !parsed.success) return NextResponse.json(NO_VALUES, { status: 400 });

  try {
    const payload = await apiGet<VehicleSuggestions>(`${apiPath}${qs(parsed.data)}`, {
      revalidate: false,
    });
    return NextResponse.json(payload, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return problemResponse(error, route);
  }
}
