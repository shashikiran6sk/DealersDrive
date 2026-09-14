import { NextResponse } from 'next/server';

import { ApiError, apiSend } from '@/lib/api';
import { revalidatePublicDealer } from '@/lib/cache-tags';
import { currentSession } from '@/lib/session';

export async function DELETE(): Promise<NextResponse> {
  try {
    await apiSend('DELETE', '/v1/dealer/yard-photo');

    const session = await currentSession();
    revalidatePublicDealer(session?.dealer?.slug);

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
