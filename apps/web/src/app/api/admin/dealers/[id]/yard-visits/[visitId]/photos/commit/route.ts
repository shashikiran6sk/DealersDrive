import { YardVisitPhotoCommitInput } from '@dealers-drive/contracts';
import type { NextResponse } from 'next/server';

import { yardVisitPhotoPath } from '@/lib/admin-bff';
import { proxyJson } from '@/lib/sales-bff';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; visitId: string }> },
): Promise<NextResponse> {
  const { id, visitId } = await params;
  return proxyJson(
    request,
    YardVisitPhotoCommitInput,
    yardVisitPhotoPath(id, visitId, 'commit'),
    '/api/admin/dealers/[id]/yard-visits/[visitId]/photos/commit',
  );
}
