import { DealerDocType } from '@dealers-drive/contracts';
import { NextResponse } from 'next/server';

import { ApiError, apiSend } from '@/lib/api';

/**
 * BFF for C5 delete — the half of "replace" that removes what was there.
 *
 * A dealer who uploaded the wrong scan of their PAN card needs a way to take it
 * back, and "upload a different one over the top" is not that: it leaves the
 * first file in storage. The API deletes both the row's contents and the
 * object; this proxies it so the session, not a client-supplied id, decides
 * whose document is being removed (Rule 1).
 */
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
    if (error instanceof ApiError) {
      return NextResponse.json(error.problem, {
        status: error.status,
        headers: { 'Content-Type': 'application/problem+json' },
      });
    }
    return NextResponse.json({ error: 'Upstream unavailable.' }, { status: 502 });
  }
}
