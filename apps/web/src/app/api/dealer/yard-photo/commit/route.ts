import { YardPhotoCommitInput, type YardPhotoDto } from '@dealers-drive/contracts';
import { NextResponse } from 'next/server';

import { ApiError, apiSend } from '@/lib/api';
import { revalidatePublicDealer } from '@/lib/cache-tags';
import { currentSession } from '@/lib/session';

export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Expected a JSON body.' }, { status: 400 });
  }

  const parsed = YardPhotoCommitInput.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Expected { mediaId }.' }, { status: 400 });
  }

  try {
    const result = await apiSend<YardPhotoDto>('POST', '/v1/dealer/yard-photo/commit', parsed.data);

    await revalidateForCurrentDealer();

    return NextResponse.json(result);
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

async function revalidateForCurrentDealer(): Promise<void> {
  const session = await currentSession();
  revalidatePublicDealer(session?.dealer?.slug);
}
