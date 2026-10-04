import { DealerDocType } from '@dealers-drive/contracts';
import { NextResponse } from 'next/server';

import { apiSend } from '@/lib/api';
import { problemResponse } from '@/lib/bff';

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ type: string }> },
): Promise<NextResponse> {
  const type = DealerDocType.safeParse((await params).type);
  if (!type.success) {
    return NextResponse.json({ error: 'Unknown document type.' }, { status: 400 });
  }

  try {
    await apiSend('DELETE', `/v1/dealer/documents/${type.data}`);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return problemResponse(error, '/api/dealer/documents/[type]');
  }
}
