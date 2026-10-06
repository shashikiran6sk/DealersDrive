import { DealerDocType } from '@dealers-drive/contracts';
import type { NextResponse } from 'next/server';

import { proxyDelete, salesDealerPath } from '@/lib/sales-bff';

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; type: string }> },
): Promise<NextResponse> {
  const { id, type } = await params;
  const base = salesDealerPath(id);
  const docType = DealerDocType.safeParse(type);
  return proxyDelete(
    base && docType.success ? `${base}/documents/${docType.data}` : null,
    '/api/sales/dealers/[id]/documents/[type]',
  );
}
