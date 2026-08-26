import type { ModelVariantsResponse } from '@dealers-drive/contracts';
import { NextResponse } from 'next/server';

import { ApiError, apiGet } from '@/lib/api';

/**
 * BFF for A13b — the add-vehicle form's Variant field.
 *
 * The browser has to make this call: which model the dealer picked is only
 * known after they pick it, and re-rendering the whole wizard on the server for
 * a dropdown would cost a round trip and the focus position. It is proxied here
 * rather than fetched cross-origin because the API base URL must not become a
 * `NEXT_PUBLIC_*` variable (Rule 9).
 *
 * Anonymous and cacheable: the catalogue is public reference data, so no
 * session cookie is forwarded and the response can sit in the browser's cache
 * for an hour like the upstream one does.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;

  try {
    const result = await apiGet<ModelVariantsResponse>(
      `/v1/catalog/models/${encodeURIComponent(id)}/variants`,
      { revalidate: 3600 },
    );
    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'public, max-age=3600, stale-while-revalidate=600' },
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
