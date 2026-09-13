import type { DealerSuggestResponse } from '@dealers-drive/contracts';
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as ApiModule from '@/lib/api';
import { ApiError } from '@/lib/api';

/**
 * `src/app/api/search/dealers/route.ts` (**R43**) — the BFF the typeahead calls.
 *
 * It exists because the browser cannot reach the API directly without a
 * `NEXT_PUBLIC_*` origin in the bundle, which would end build-once-promote-many
 * (rule 9). What is worth testing is the part that is not a proxy: it parses the
 * query with the *same contract the API validates with*, so a malformed request
 * is answered here rather than a process away, and only parameters the schema
 * names travel upstream.
 */
const apiGet = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof ApiModule>()),
  apiGet,
}));

const { GET } = await import('@/app/api/search/dealers/route');

const PAYLOAD: DealerSuggestResponse = {
  search: 'vel',
  data: [],
  countLabel: '0 matching yards',
};

function request(query: string): NextRequest {
  return new NextRequest(`http://localhost:3000/api/search/dealers${query}`);
}

beforeEach(() => {
  apiGet.mockReset();
  apiGet.mockResolvedValue(PAYLOAD);
});

describe('GET /api/search/dealers', () => {
  it('passes the search upstream and answers with what came back', async () => {
    const response = await GET(request('?search=vel'));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(PAYLOAD);
    expect(apiGet).toHaveBeenCalledWith('/v1/search/dealers?search=vel&limit=6', {
      revalidate: 60,
    });
  });

  it('forwards the page’s district and towns', async () => {
    await GET(request('?search=vel&district=vellore&city=ambur,katpadi'));

    const [path] = apiGet.mock.calls[0] as [string];
    expect(path).toContain('district=vellore');
    expect(path).toContain('city=ambur%2Ckatpadi');
  });

  /**
   * The typeahead re-asks the same question constantly — a backspace is a
   * question already answered — so both caches matter. See the route's docblock.
   */
  it('offers the answer to the browser for a minute', async () => {
    const response = await GET(request('?search=vel'));

    expect(response.headers.get('Cache-Control')).toBe('public, max-age=60');
  });

  it('refuses an empty search here rather than a process away', async () => {
    const response = await GET(request('?search='));

    expect(response.status).toBe(400);
    expect(apiGet).not.toHaveBeenCalled();
  });

  /**
   * `.strict()` upstream, and `.strict()` here. `?q=` is the *directory's*
   * parameter and therefore the one a hand-written call reaches for first — so
   * it is the one that must be named rather than silently ignored.
   */
  it('names an unknown parameter instead of dropping it', async () => {
    const response = await GET(request('?search=vel&q=vel'));

    expect(response.status).toBe(400);
    expect(response.headers.get('Content-Type')).toBe('application/problem+json');
    expect(JSON.stringify(await response.json())).toContain('q');
    expect(apiGet).not.toHaveBeenCalled();
  });

  it('refuses a limit past what a dropdown can be read at', async () => {
    expect((await GET(request('?search=vel&limit=50'))).status).toBe(400);
  });

  it('relays the API’s own problem document', async () => {
    apiGet.mockRejectedValue(
      new ApiError({
        type: 'about:blank',
        title: 'Too many requests',
        status: 429,
        code: 'RATE_LIMITED',
      }),
    );

    const response = await GET(request('?search=vel'));

    expect(response.status).toBe(429);
    expect(response.headers.get('Content-Type')).toBe('application/problem+json');
  });

  it('answers 502 when the API cannot be reached at all', async () => {
    apiGet.mockRejectedValue(new Error('connect ECONNREFUSED'));

    // The box degrades to "Suggestions are unavailable just now"; the directory
    // behind it is untouched, because it was rendered from a different call.
    expect((await GET(request('?search=vel'))).status).toBe(502);
  });
});
