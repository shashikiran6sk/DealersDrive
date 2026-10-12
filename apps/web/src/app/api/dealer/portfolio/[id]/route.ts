import { PortfolioPhotoParam } from '@dealers-drive/contracts';
import { NextResponse } from 'next/server';

import { apiSend } from '@/lib/api';
import { problemResponse } from '@/lib/bff';
import { revalidatePublicDealer } from '@/lib/cache-tags';
import { currentSession } from '@/lib/session';

import { PORTFOLIO_API_PATH, PORTFOLIO_BFF_TEXT } from '../portfolio.constants';

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const parsed = PortfolioPhotoParam.safeParse(await params);
  if (!parsed.success) {
    return NextResponse.json({ error: PORTFOLIO_BFF_TEXT.unknownPhoto }, { status: 400 });
  }

  try {
    await apiSend('DELETE', `${PORTFOLIO_API_PATH}/${encodeURIComponent(parsed.data.id)}`);

    const session = await currentSession();
    revalidatePublicDealer(session?.dealer?.slug);

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return problemResponse(error, '/api/dealer/portfolio/[id]');
  }
}
