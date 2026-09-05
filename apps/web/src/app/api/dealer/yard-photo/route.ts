import { NextResponse } from 'next/server';

import { ApiError, apiSend } from '@/lib/api';

/** BFF for removing the yard photograph. The dealership reads as incomplete again. */
export async function DELETE(): Promise<NextResponse> {
  try {
    await apiSend('DELETE', '/v1/dealer/yard-photo');
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
