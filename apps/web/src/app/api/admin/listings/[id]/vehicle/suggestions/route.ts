import { IdParam } from '@dealers-drive/contracts';
import type { NextRequest, NextResponse } from 'next/server';

import { proxyVehicleSuggestions } from '@/lib/vehicle-suggestions-bff';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const id = IdParam.safeParse(await params);
  return proxyVehicleSuggestions(
    request,
    id.success ? `/v1/admin/listings/${id.data.id}/vehicle/suggestions` : null,
    '/api/admin/listings/[id]/vehicle/suggestions',
  );
}
