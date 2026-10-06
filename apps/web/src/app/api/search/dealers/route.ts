import { DealerSuggestQuery, type DealerSuggestResponse } from '@dealers-drive/contracts';
import { NextResponse, type NextRequest } from 'next/server';

import { apiGet, qs } from '@/lib/api';
import { problemResponse } from '@/lib/bff';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const parsed = DealerSuggestQuery.safeParse(
    Object.fromEntries(request.nextUrl.searchParams.entries()),
  );

  if (!parsed.success) {
    return NextResponse.json(
      {
        type: 'about:blank',
        title: 'Invalid search',
        status: 400,
        code: 'VALIDATION',
        errors: parsed.error.issues.map((issue) => ({
          field: issue.path.join('.') || 'search',
          message: issue.message,
        })),
      },
      { status: 400, headers: { 'Content-Type': 'application/problem+json' } },
    );
  }

  const { search, limit, city, district } = parsed.data;

  try {
    const payload = await apiGet<DealerSuggestResponse>(
      `/v1/search/dealers${qs({ search, limit, city, district })}`,
      { revalidate: 60 },
    );

    return NextResponse.json(payload, {
      headers: { 'Cache-Control': 'public, max-age=60' },
    });
  } catch (error) {
    return problemResponse(error, '/api/search/dealers');
  }
}
