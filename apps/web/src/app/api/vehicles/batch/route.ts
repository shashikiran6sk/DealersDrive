import { VehicleBatchInput, type VehicleBatchResponse } from '@dealers-drive/contracts';
import { NextResponse } from 'next/server';

import { ApiError, apiSend } from '@/lib/api';

/**
 * BFF for A4 — the one call the browser genuinely has to make itself.
 *
 * Saved cars live in `localStorage` (there are no buyer accounts), so only the
 * browser knows the ids; but the API base URL must not be a `NEXT_PUBLIC_*`
 * variable (Rule 9, ARCHITECTURE §15.3), so the request is proxied here rather
 * than made cross-origin from the page.
 */
export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Expected a JSON body.' }, { status: 400 });
  }

  const parsed = VehicleBatchInput.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Expected { ids: string[] }.' }, { status: 400 });
  }

  try {
    const result = await apiSend<VehicleBatchResponse>('POST', '/v1/vehicles/batch', parsed.data);
    return NextResponse.json(result);
  } catch (error) {
    // The Problem Details document is already a safe, public shape — pass it
    // through rather than inventing a second error vocabulary here.
    if (error instanceof ApiError) {
      return NextResponse.json(error.problem, {
        status: error.status,
        headers: { 'Content-Type': 'application/problem+json' },
      });
    }
    return NextResponse.json({ error: 'Upstream unavailable.' }, { status: 502 });
  }
}
