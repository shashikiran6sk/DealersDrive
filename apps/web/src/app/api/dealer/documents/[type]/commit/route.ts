import { DealerDocType, DocumentCommitInput } from '@dealers-drive/contracts';
import { NextResponse } from 'next/server';

import { ApiError, apiSend } from '@/lib/api';

/** BFF for C5 commit — the step that turns an uploaded object into a record. */
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
    if (error instanceof ApiError) {
      return NextResponse.json(error.problem, {
        status: error.status,
        headers: { 'Content-Type': 'application/problem+json' },
      });
    }
    return NextResponse.json({ error: 'Upstream unavailable.' }, { status: 502 });
  }
}
