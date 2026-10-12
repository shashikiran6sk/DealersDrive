import { PortfolioPhotoCommitInput, type DealerPortfolioPhoto } from '@dealers-drive/contracts';
import { NextResponse } from 'next/server';

import { apiSend } from '@/lib/api';
import { problemResponse } from '@/lib/bff';

import { PORTFOLIO_API_PATH, PORTFOLIO_BFF_TEXT } from '../portfolio.constants';

export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: PORTFOLIO_BFF_TEXT.notJson }, { status: 400 });
  }

  const parsed = PortfolioPhotoCommitInput.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: PORTFOLIO_BFF_TEXT.cannotCommit, issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const photo = await apiSend<DealerPortfolioPhoto>(
      'POST',
      `${PORTFOLIO_API_PATH}/commit`,
      parsed.data,
    );
    return NextResponse.json(photo, { status: 201 });
  } catch (error) {
    return problemResponse(error, '/api/dealer/portfolio/commit');
  }
}
