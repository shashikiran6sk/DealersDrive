import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as ApiModule from '@/lib/api';

/**
 * #299 — the admin yard-visit photograph upload proxies. Only the signing and
 * the commit pass through the BFF; the bytes go straight to storage. Both
 * refuse an id that is not a UUID before the API is asked anything.
 */
const apiSend = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof ApiModule>()),
  apiSend,
}));

const { POST: presign } =
  await import('@/app/api/admin/dealers/[id]/yard-visits/[visitId]/photos/presign/route');
const { POST: commit } =
  await import('@/app/api/admin/dealers/[id]/yard-visits/[visitId]/photos/commit/route');

const DEALER = '3c8f2b10-2222-4000-8000-000000000002';
const VISIT = '5a1d0c33-1111-4000-8000-000000000001';
const MEDIA = '5a1d0c33-1111-4000-8000-0000000000a1';

function post(body: unknown): Request {
  return new Request('http://localhost/api', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function params(id: string, visitId: string) {
  return { params: Promise.resolve({ id, visitId }) };
}

beforeEach(() => apiSend.mockReset());

describe('the yard-visit photograph proxies', () => {
  it('signs an upload against the visit and answers 201', async () => {
    apiSend.mockResolvedValue({ mediaId: MEDIA, uploadUrl: 'https://storage.test/put' });

    const response = await presign(
      post({ fileName: 'yard.jpg', mimeType: 'image/jpeg', bytes: 2048 }),
      params(DEALER, VISIT),
    );

    expect(response.status).toBe(201);
    expect(apiSend).toHaveBeenCalledWith(
      'POST',
      `/v1/admin/dealers/${DEALER}/yard-visits/${VISIT}/photos/presign`,
      { fileName: 'yard.jpg', mimeType: 'image/jpeg', bytes: 2048 },
    );
  });

  it('refuses a file that is not an image, before calling the API', async () => {
    const response = await presign(
      post({ fileName: 'yard.pdf', mimeType: 'application/pdf', bytes: 2048 }),
      params(DEALER, VISIT),
    );

    expect(response.status).toBe(400);
    expect(apiSend).not.toHaveBeenCalled();
  });

  it('refuses an id that is not a UUID', async () => {
    const response = await commit(post({ mediaId: MEDIA }), params('not-a-dealer', VISIT));

    expect(response.status).toBe(400);
    expect(apiSend).not.toHaveBeenCalled();
  });

  it('commits the uploaded photograph to the visit', async () => {
    apiSend.mockResolvedValue({ id: VISIT, photos: [] });

    const response = await commit(post({ mediaId: MEDIA }), params(DEALER, VISIT));

    expect(response.status).toBe(200);
    expect(apiSend).toHaveBeenCalledWith(
      'POST',
      `/v1/admin/dealers/${DEALER}/yard-visits/${VISIT}/photos/commit`,
      { mediaId: MEDIA },
    );
  });
});
