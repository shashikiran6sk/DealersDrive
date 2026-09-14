import { DealerSuggestQuery, type DealerSuggestResponse } from '@dealers-drive/contracts';
import { NextResponse, type NextRequest } from 'next/server';

import { ApiError, apiGet, qs } from '@/lib/api';

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
    if (error instanceof ApiError) {
      return NextResponse.json(error.problem, {
        status: error.status,
        headers: { 'Content-Type': 'application/problem+json' },
      });
    }
    return NextResponse.json({ error: 'Upstream unavailable.' }, { status: 502 });
  }
}
