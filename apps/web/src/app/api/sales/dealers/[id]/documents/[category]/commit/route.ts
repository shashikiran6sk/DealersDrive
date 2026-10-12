import { DocumentCommitInput, SelectableDocCategory } from '@dealers-drive/contracts';
import type { NextResponse } from 'next/server';

import { proxyJson, salesDealerPath } from '@/lib/sales-bff';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; category: string }> },
): Promise<NextResponse> {
  const { id, category } = await params;
  const base = salesDealerPath(id);
  const parsed = SelectableDocCategory.safeParse(category);
  return proxyJson(
    request,
    DocumentCommitInput,
    base && parsed.success ? `${base}/documents/${parsed.data}/commit` : null,
    '/api/sales/dealers/[id]/documents/[category]/commit',
  );
}
