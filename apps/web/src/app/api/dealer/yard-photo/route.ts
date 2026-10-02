import { NextResponse } from 'next/server';

import { apiSend } from '@/lib/api';
import { problemResponse } from '@/lib/bff';
import { revalidatePublicDealer } from '@/lib/cache-tags';
import { currentSession } from '@/lib/session';

export async function DELETE(): Promise<NextResponse> {
  try {
    await apiSend('DELETE', '/v1/dealer/yard-photo');

    const session = await currentSession();
    revalidatePublicDealer(session?.dealer?.slug);

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return problemResponse(error, '/api/dealer/yard-photo');
  }
}
