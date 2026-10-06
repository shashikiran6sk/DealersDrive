import { DealerDocType, DocumentCommitInput } from '@dealers-drive/contracts';
import type { NextResponse } from 'next/server';

import { proxyJson, salesDealerPath } from '@/lib/sales-bff';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; type: string }> },
): Promise<NextResponse> {
  const { id, type } = await params;
  const base = salesDealerPath(id);
  const docType = DealerDocType.safeParse(type);
  return proxyJson(
    request,
    DocumentCommitInput,
    base && docType.success ? `${base}/documents/${docType.data}/commit` : null,
    '/api/sales/dealers/[id]/documents/[type]/commit',
  );
}
