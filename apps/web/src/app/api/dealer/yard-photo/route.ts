import { NextResponse } from 'next/server';

import { ApiError, apiSend } from '@/lib/api';
import { revalidatePublicDealer } from '@/lib/cache-tags';
import { currentSession } from '@/lib/session';

/** BFF for removing the yard photograph. The dealership reads as incomplete again. */
export async function DELETE(): Promise<NextResponse> {
  try {
    await apiSend('DELETE', '/v1/dealer/yard-photo');

    // A removed photograph has to disappear from the public pages as promptly
    // as a new one appears there — more so, if it was removed *because* it
    // should not have been published.
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
