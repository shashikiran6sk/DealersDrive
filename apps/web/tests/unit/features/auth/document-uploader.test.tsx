import type { DealerDocumentDto } from '@dealers-drive/contracts';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DocumentUploader } from '@/features/auth/document-uploader';

const ORIGINAL_FETCH = globalThis.fetch;

const GST: DealerDocumentDto = {
  id: null,
  type: 'GST_CERTIFICATE',
  label: 'GST certificate',
  status: 'REQUIRED',
  statusLabel: 'Required',
  fileName: null,
  uploadedAt: null,
  rejectionReason: null,
  action: 'Upload',
};

function okJson(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH;
});

/**
 * R112 — the uploader is shared by the dealer and by a Sales representative.
 * The URL base is a string prop, because the Sales page is a server component
 * and a function cannot cross into a client one.
 */
describe('DocumentUploader', () => {
  async function uploadThrough(basePath?: string): Promise<string[]> {
    const fetchMock = vi.fn((url: string) =>
      Promise.resolve(
        url.endsWith('/presign')
          ? okJson({
              documentId: '00000000-0000-4000-8000-000000000001',
              uploadUrl: 'https://storage.test/put',
              method: 'PUT',
              headers: {},
              expiresInSeconds: 300,
            })
          : okJson({}),
      ),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const user = userEvent.setup();
    render(<DocumentUploader document={GST} {...(basePath ? { basePath } : {})} />);

    const file = new File(['%PDF-1.4'], 'gst.pdf', { type: 'application/pdf' });
    await user.upload(screen.getByLabelText('Upload GST certificate'), file);
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });
    return fetchMock.mock.calls.map(([url]) => url);
  }

  it('uploads through the dealer’s own routes by default', async () => {
    expect(await uploadThrough()).toEqual([
      '/api/dealer/documents/presign',
      'https://storage.test/put',
      '/api/dealer/documents/GST_CERTIFICATE/commit',
    ]);
  });

  it('uploads through the Sales routes when given their base', async () => {
    expect(await uploadThrough('/api/sales/dealers/d-1/documents')).toEqual([
      '/api/sales/dealers/d-1/documents/presign',
      'https://storage.test/put',
      '/api/sales/dealers/d-1/documents/GST_CERTIFICATE/commit',
    ]);
  });
});
