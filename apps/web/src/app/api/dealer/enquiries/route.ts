import { EnquiryQuery, type EnquiryListResponse } from '@dealers-drive/contracts';
import { NextResponse } from 'next/server';

import { ApiError, apiGet, qs } from '@/lib/api';

/**
 * BFF for C15 — the enquiry inbox's tab switch.
 *
 * ARCHITECTURE §15.1: "switching tabs is a client fetch, not a navigation".
 * The API base URL stays server-side (Rule 9), and — this is the point — no
 * dealer id crosses the wire in either direction. The upstream call carries the
 * session; the tab is the only thing the browser gets to choose (Rule 1).
 */
export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);

  const parsed = EnquiryQuery.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Unsupported query.' }, { status: 400 });
  }

  try {
    const result = await apiGet<EnquiryListResponse>(
      `/v1/dealer/enquiries${qs({ ...parsed.data })}`,
      { revalidate: false },
    );
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
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
