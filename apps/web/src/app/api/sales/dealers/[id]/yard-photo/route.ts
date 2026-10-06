import type { NextResponse } from 'next/server';

import { proxyDelete, salesDealerPath } from '@/lib/sales-bff';

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const base = salesDealerPath((await params).id);
  return proxyDelete(base && `${base}/yard-photo`, '/api/sales/dealers/[id]/yard-photo');
}
