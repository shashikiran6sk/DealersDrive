import { DocumentPresignInput } from '@dealers-drive/contracts';
import type { NextResponse } from 'next/server';

import { proxyJson, salesDealerPath } from '@/lib/sales-bff';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const base = salesDealerPath((await params).id);
  return proxyJson(
    request,
    DocumentPresignInput,
    base && `${base}/documents/presign`,
    '/api/sales/dealers/[id]/documents/presign',
    201,
  );
}
