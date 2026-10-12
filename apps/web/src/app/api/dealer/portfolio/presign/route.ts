import {
  PortfolioPhotoPresignInput,
  type PortfolioPhotoPresignResponse,
} from '@dealers-drive/contracts';
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

  const parsed = PortfolioPhotoPresignInput.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: PORTFOLIO_BFF_TEXT.cannotUpload, issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const result = await apiSend<PortfolioPhotoPresignResponse>(
      'POST',
      `${PORTFOLIO_API_PATH}/presign`,
      parsed.data,
    );
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return problemResponse(error, '/api/dealer/portfolio/presign');
  }
}
