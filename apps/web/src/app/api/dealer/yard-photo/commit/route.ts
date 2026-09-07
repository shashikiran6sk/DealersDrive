import { YardPhotoCommitInput, type YardPhotoDto } from '@dealers-drive/contracts';
import { NextResponse } from 'next/server';

import { ApiError, apiSend } from '@/lib/api';
import { revalidatePublicDealer } from '@/lib/cache-tags';
import { currentSession } from '@/lib/session';

/** BFF for the yard-photograph commit — the step that adopts an uploaded object. */
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

    /*
     * The photograph is the first thing a buyer sees of a dealership — the
     * directory card's cover and the portfolio's hero — so a new one has to
     * appear rather than wait out a ten-minute window (`lib/cache-tags.ts`).
     *
     * The slug costs a `GET /v1/auth/me` because `YardPhotoDto` has no reason
     * to carry one. That is a fair price on a path that has just uploaded an
     * image, and it is not on any read.
     */
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

/**
 * Clears this dealership's public pages, whoever it is.
 *
 * A route handler has the session cookie but not the dealership's slug, and
 * neither the commit nor the delete answers with one. A signed-out caller never
 * reaches here — the API would have refused first — so a null session means
 * there is nothing to clear.
 */
async function revalidateForCurrentDealer(): Promise<void> {
  const session = await currentSession();
  revalidatePublicDealer(session?.dealer?.slug);
}
