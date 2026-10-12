import { SelectableDocCategory } from '@dealers-drive/contracts';
import type { NextResponse } from 'next/server';

import { proxyDelete, salesDealerPath } from '@/lib/sales-bff';

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; category: string }> },
): Promise<NextResponse> {
  const { id, category } = await params;
  const base = salesDealerPath(id);
  const parsed = SelectableDocCategory.safeParse(category);
  return proxyDelete(
    base && parsed.success ? `${base}/documents/${parsed.data}` : null,
    '/api/sales/dealers/[id]/documents/[category]',
  );
}
