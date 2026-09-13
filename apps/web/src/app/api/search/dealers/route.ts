import { DealerSuggestQuery, type DealerSuggestResponse } from '@dealers-drive/contracts';
import { NextResponse, type NextRequest } from 'next/server';

import { ApiError, apiGet, qs } from '@/lib/api';

/**
 * BFF for the dealer typeahead (**R43**) — `GET /api/search/dealers?search=…`.
 *
 * ## Why a BFF at all
 *
 * The browser cannot call the API directly. Doing so would need the API's
 * origin in the bundle, which means a `NEXT_PUBLIC_*` variable, which means the
 * build is no longer promotable between environments (CLAUDE.md rule 9,
 * ARCHITECTURE §15.3). Every other browser-initiated call in the product goes
 * through `/api/*` for the same reason, and this is one of the two things a
 * typeahead is: a request that genuinely cannot be expressed as a navigation.
 *
 * ## Why it validates rather than forwarding the query string
 *
 * The upstream schema is `.strict()`, so a forwarded `?foo=` would be a 400
 * from the API — correct, but the error would name a parameter this route
 * accepted and cross an extra process to reject. Parsing here means the
 * browser's mistakes are answered here, and the only thing that reaches the API
 * is a query it has already agreed to. `qs()` then re-encodes from the *parsed*
 * object, so nothing travels upstream that the schema did not name.
 *
 * ## Caching
 *
 * `revalidate: 60` matches the API's own `max-age`, and the same minute is
 * offered to the browser. Both matter, and they do different jobs: the Next
 * cache collapses the same prefix typed by many buyers into one upstream call,
 * and the browser cache makes backspacing — which re-asks a question already
 * answered — free. A typeahead is the one surface where a buyer routinely
 * issues the identical request twice within seconds.
 *
 * It is anonymous, so `public` is safe: no session is forwarded on a cached
 * fetch (see `lib/api.ts`), and there is nothing dealer-specific in the answer.
 */
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
    /*
     * The box degrades rather than breaking: a 502 here renders as "Suggestions
     * are unavailable just now", and the directory underneath is untouched
     * because it was server-rendered from a different call.
     */
    return NextResponse.json({ error: 'Upstream unavailable.' }, { status: 502 });
  }
}
