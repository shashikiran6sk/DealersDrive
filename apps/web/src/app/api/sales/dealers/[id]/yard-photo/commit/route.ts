import { YardPhotoCommitInput } from '@dealers-drive/contracts';
import type { NextResponse } from 'next/server';

import { proxyJson, salesDealerPath } from '@/lib/sales-bff';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const base = salesDealerPath((await params).id);
  return proxyJson(
    request,
    YardPhotoCommitInput,
    base && `${base}/yard-photo/commit`,
    '/api/sales/dealers/[id]/yard-photo/commit',
  );
}
