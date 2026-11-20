import type { NextRequest, NextResponse } from 'next/server';

import { salesDealerPath } from '@/lib/sales-bff';
import { proxyVehicleSuggestions } from '@/lib/vehicle-suggestions-bff';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const base = salesDealerPath((await params).id);
  return proxyVehicleSuggestions(
    request,
    base && `${base}/vehicles/suggestions`,
    '/api/sales/dealers/[id]/vehicles/suggestions',
  );
}
