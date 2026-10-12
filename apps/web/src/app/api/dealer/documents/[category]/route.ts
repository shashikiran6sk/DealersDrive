import { DocCategoryParam } from '@dealers-drive/contracts';
import { NextResponse } from 'next/server';

import { apiSend } from '@/lib/api';
import { problemResponse } from '@/lib/bff';

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ category: string }> },
): Promise<NextResponse> {
  const parsed = DocCategoryParam.safeParse(await params);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Unknown document category.' }, { status: 400 });
  }

  try {
    await apiSend('DELETE', `/v1/dealer/documents/${parsed.data.category}`);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return problemResponse(error, '/api/dealer/documents/[category]');
  }
}
