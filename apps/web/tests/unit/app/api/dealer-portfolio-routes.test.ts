import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as ApiModule from '@/lib/api';
import { ApiError } from '@/lib/api';

/**
 * `src/app/api/dealer/portfolio/**` (#299) — the BFF the portfolio manager
 * uploads through. What is not a proxy: each body is parsed with the contract
 * the API validates with, so a field the schema does not name is refused here,
 * and removing a photograph refreshes the public page it may have been on.
 */
const apiSend = vi.hoisted(() => vi.fn());
const revalidatePublicDealer = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof ApiModule>()),
  apiSend,
}));
vi.mock('@/lib/cache-tags', () => ({ revalidatePublicDealer }));
vi.mock('@/lib/session', () => ({
  currentSession: () => Promise.resolve({ dealer: { slug: 'sri-lakshmi-motors' } }),
}));

const { POST: presign } = await import('@/app/api/dealer/portfolio/presign/route');
const { POST: commit } = await import('@/app/api/dealer/portfolio/commit/route');
const { DELETE: remove } = await import('@/app/api/dealer/portfolio/[id]/route');

const PHOTO_ID = '00000000-0000-4000-8000-000000000001';
const MEDIA_ID = '00000000-0000-4000-8000-0000000000aa';

function post(body: unknown): Request {
  return new Request('http://localhost:3000/api/dealer/portfolio', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  apiSend.mockReset();
  revalidatePublicDealer.mockReset();
});

describe('POST /api/dealer/portfolio/presign', () => {
  it('forwards a replacement’s presign with 201', async () => {
    apiSend.mockResolvedValue({ mediaId: MEDIA_ID, uploadUrl: 'https://s.test', method: 'PUT' });
    const body = {
      fileName: 'yard.jpg',
      mimeType: 'image/jpeg',
      bytes: 1024,
      replacesId: PHOTO_ID,
    };

    const response = await presign(post(body));

    expect(response.status).toBe(201);
    expect(apiSend).toHaveBeenCalledWith('POST', '/v1/dealer/portfolio/presign', body);
  });

  it('refuses a document type, an oversized file and a dealerId before the API sees them', async () => {
    for (const body of [
      { fileName: 'gst.pdf', mimeType: 'application/pdf', bytes: 1024 },
      { fileName: 'yard.jpg', mimeType: 'image/jpeg', bytes: 11 * 1024 * 1024 },
      { fileName: 'yard.jpg', mimeType: 'image/jpeg', bytes: 1024, dealerId: PHOTO_ID },
    ]) {
      expect((await presign(post(body))).status).toBe(400);
    }
    expect(apiSend).not.toHaveBeenCalled();
  });
});

describe('POST /api/dealer/portfolio/commit', () => {
  it('forwards the commit and passes the API’s refusal through', async () => {
    apiSend.mockRejectedValue(
      new ApiError({
        type: 'about:blank',
        title: 'Conflict',
        status: 409,
        code: 'PORTFOLIO_REPLACEMENT_PENDING',
        detail: 'A replacement for that photograph is already waiting for review.',
      }),
    );

    const response = await commit(post({ mediaId: MEDIA_ID, replacesId: PHOTO_ID }));

    expect(apiSend).toHaveBeenCalledWith('POST', '/v1/dealer/portfolio/commit', {
      mediaId: MEDIA_ID,
      replacesId: PHOTO_ID,
    });
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: 'PORTFOLIO_REPLACEMENT_PENDING' });
  });
});

describe('DELETE /api/dealer/portfolio/:id', () => {
  it('removes the photograph and refreshes the dealership’s public page', async () => {
    apiSend.mockResolvedValue(undefined);

    const response = await remove(new Request('http://localhost:3000'), {
      params: Promise.resolve({ id: PHOTO_ID }),
    });

    expect(response.status).toBe(204);
    expect(apiSend).toHaveBeenCalledWith('DELETE', `/v1/dealer/portfolio/${PHOTO_ID}`);
    expect(revalidatePublicDealer).toHaveBeenCalledWith('sri-lakshmi-motors');
  });

  it('refuses an id that is not one', async () => {
    const response = await remove(new Request('http://localhost:3000'), {
      params: Promise.resolve({ id: '../yard-photo' }),
    });

    expect(response.status).toBe(400);
    expect(apiSend).not.toHaveBeenCalled();
  });
});
