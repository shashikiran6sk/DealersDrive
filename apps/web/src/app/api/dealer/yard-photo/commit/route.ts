import { YardPhotoCommitInput, type YardPhotoDto } from '@dealers-drive/contracts';
import { NextResponse } from 'next/server';

import { apiSend } from '@/lib/api';
import { problemResponse } from '@/lib/bff';
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
    return problemResponse(error, '/api/dealer/yard-photo/commit');
  }
}

async function revalidateForCurrentDealer(): Promise<void> {
  const session = await currentSession();
  revalidatePublicDealer(session?.dealer?.slug);
}
