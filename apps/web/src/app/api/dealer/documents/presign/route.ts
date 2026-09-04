import { DocumentPresignInput, type PresignResponse } from '@dealers-drive/contracts';
import { NextResponse } from 'next/server';

import { ApiError, apiSend } from '@/lib/api';

/**
 * BFF for C5 document presign.
 *
 * Same shape as the media presign beside it, and for the same reason: the file
 * goes **straight from the browser to storage**, and only the signing call is
 * proxied — because it needs the API base URL and the session, neither of which
 * belongs in a browser bundle (Rule 9).
 */
export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Expected a JSON body.' }, { status: 400 });
  }

  const parsed = DocumentPresignInput.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'That file cannot be uploaded.', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const result = await apiSend<PresignResponse>(
      'POST',
      '/v1/dealer/documents/presign',
      parsed.data,
    );
    return NextResponse.json(result, { status: 201 });
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
