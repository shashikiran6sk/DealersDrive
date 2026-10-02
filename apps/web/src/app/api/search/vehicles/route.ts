import { CarSuggestQuery, type CarSuggestResponse } from '@dealers-drive/contracts';
import { NextResponse, type NextRequest } from 'next/server';

import { apiGet, qs } from '@/lib/api';
import { problemResponse } from '@/lib/bff';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const parsed = CarSuggestQuery.safeParse(
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

  const { search, limit, district, city, dealer } = parsed.data;

  try {
    const payload = await apiGet<CarSuggestResponse>(
      `/v1/search/vehicles${qs({ search, limit, district, city: city?.join(','), dealer: dealer?.join(',') })}`,
      { revalidate: 60 },
    );

    return NextResponse.json(payload, {
      headers: { 'Cache-Control': 'public, max-age=60' },
    });
  } catch (error) {
    return problemResponse(error, '/api/search/vehicles');
  }
}
