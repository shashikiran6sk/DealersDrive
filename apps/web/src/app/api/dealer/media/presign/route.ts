import { MediaPresignInput, type PresignResponse } from '@dealers-drive/contracts';
import { NextResponse } from 'next/server';

import { ApiError, apiSend } from '@/lib/api';

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
