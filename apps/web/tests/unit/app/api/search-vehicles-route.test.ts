import type { CarSuggestResponse } from '@dealers-drive/contracts';
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as ApiModule from '@/lib/api';
import { ApiError } from '@/lib/api';

/**
 * `src/app/api/search/vehicles/route.ts` (**R54**) — the BFF the car typeahead
 * calls, the twin of `/api/search/dealers`. It parses with the contract the API
 * validates with, so a malformed request is answered here, and only parameters
 * the schema names travel upstream.
 */
const apiGet = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof ApiModule>()),
  apiGet,
}));

const { GET } = await import('@/app/api/search/vehicles/route');

const PAYLOAD: CarSuggestResponse = { search: 'cre', data: [], countLabel: '0 matches' };

function request(query: string): NextRequest {
  return new NextRequest(`http://localhost:3000/api/search/vehicles${query}`);
}

beforeEach(() => {
  apiGet.mockReset();
  apiGet.mockResolvedValue(PAYLOAD);
});

describe('GET /api/search/vehicles', () => {
  it('passes the search upstream and answers with what came back, cached for a minute', async () => {
    const response = await GET(request('?search=cre'));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(PAYLOAD);
    expect(response.headers.get('Cache-Control')).toBe('public, max-age=60');
    expect(apiGet).toHaveBeenCalledWith('/v1/search/vehicles?search=cre&limit=6', {
      revalidate: 60,
    });
  });

  it('forwards the page’s district, towns and dealers', async () => {
    await GET(request('?search=cre&district=ranipet&city=arcot,walajapet&dealer=a-motors'));

    const [path] = apiGet.mock.calls[0] as [string];
    expect(path).toContain('district=ranipet');
    expect(path).toContain('city=arcot%2Cwalajapet');
    expect(path).toContain('dealer=a-motors');
  });

  it.each(['?search=', '?search=cre&limit=50', '?search=cre&brand=hyundai', '?q=cre'])(
    'refuses %s here rather than a process away',
    async (query) => {
      const response = await GET(request(query));
      expect(response.status).toBe(400);
      expect(response.headers.get('Content-Type')).toBe('application/problem+json');
      expect(apiGet).not.toHaveBeenCalled();
    },
  );

  it('relays the API’s own problem document', async () => {
    apiGet.mockRejectedValue(
      new ApiError({ type: 'about:blank', title: 'Too many', status: 429, code: 'RATE_LIMITED' }),
    );
    expect((await GET(request('?search=cre'))).status).toBe(429);
  });

  it('answers 502 when the API cannot be reached at all', async () => {
    apiGet.mockRejectedValue(new Error('connect ECONNREFUSED'));
    expect((await GET(request('?search=cre'))).status).toBe(502);
  });
});
