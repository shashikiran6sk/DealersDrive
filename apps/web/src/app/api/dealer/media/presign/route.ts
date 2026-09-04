import { MediaPresignInput, type PresignResponse } from '@dealers-drive/contracts';
import { NextResponse } from 'next/server';

import { ApiError, apiSend } from '@/lib/api';

/**
 * BFF for C14 presign.
 *
 * The upload itself goes **direct from the browser to object storage** — that
 * is the whole point of the presigned PUT, and it is why 10MB photos never
 * touch this server (ARCHITECTURE §12.1). Only the signing call is proxied,
 * because it needs the API base URL and the session.
 */
export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Expected a JSON body.' }, { status: 400 });
  }

  const parsed = MediaPresignInput.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'That file cannot be uploaded.', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const result = await apiSend<PresignResponse>('POST', '/v1/dealer/media/presign', parsed.data);
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
