import type { NextRequest, NextResponse } from 'next/server';

import { proxyVehicleSuggestions } from '@/lib/vehicle-suggestions-bff';

export function GET(request: NextRequest): Promise<NextResponse> {
  return proxyVehicleSuggestions(
    request,
    '/v1/dealer/vehicles/suggestions',
    '/api/dealer/vehicles/suggestions',
  );
}
