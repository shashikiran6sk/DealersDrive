import { DealerDocType, DocumentCommitInput } from '@dealers-drive/contracts';
import { NextResponse } from 'next/server';

import { apiSend } from '@/lib/api';
import { problemResponse } from '@/lib/bff';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ type: string }> },
): Promise<NextResponse> {
  const type = DealerDocType.safeParse((await params).type);
  if (!type.success) {
    return NextResponse.json({ error: 'Unknown document type.' }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Expected a JSON body.' }, { status: 400 });
  }

  const parsed = DocumentCommitInput.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'That upload cannot be committed.' }, { status: 400 });
  }

  try {
    return NextResponse.json(
      await apiSend(`POST` as const, `/v1/dealer/documents/${type.data}/commit`, parsed.data),
    );
  } catch (error) {
    return problemResponse(error, '/api/dealer/documents/[type]/commit');
  }
}
