import {
  DOC_CATEGORY_TYPES,
  DOC_TYPE_LABELS,
  type DealerDocumentDto,
} from '@dealers-drive/contracts';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { navigationState } from '../../../setup';

import { DocumentUploader } from '@/features/auth/document-uploader';

const ORIGINAL_FETCH = globalThis.fetch;

function document(overrides: Partial<DealerDocumentDto> = {}): DealerDocumentDto {
  return {
    id: '00000000-0000-4000-8000-0000000000d1',
    category: 'BUSINESS_IDENTITY',
    categoryLabel: 'Business Identity Proof',
    type: 'GST_CERTIFICATE',
    label: 'GST Registration Certificate',
    status: 'UPLOADED',
    statusLabel: 'Submitted · awaiting review',
    fileName: 'gst.pdf',
    mimeType: 'application/pdf',
    bytes: 2048,
    description: null,
    uploadedAt: '2026-10-12T09:00:00.000Z',
    reviewedAt: null,
    rejectionReason: null,
    submissionCount: 1,
    action: 'Replace',
    ...overrides,
  };
}

function okJson(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function stubFetch() {
  const fetchMock = vi.fn((url: string, _init?: RequestInit) =>
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
  return fetchMock;
}

function presignBody(fetchMock: ReturnType<typeof stubFetch>): unknown {
  const call = fetchMock.mock.calls.find(([url]) => url.endsWith('/presign'));
  const body = call?.[1]?.body;
  return typeof body === 'string' ? JSON.parse(body) : null;
}

const PDF = new File(['%PDF-1.4'], 'proof.pdf', { type: 'application/pdf' });

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH;
});

/**
 * #299 — one card is one category slot. The type is chosen from that
 * category's list only, the presign names the category as well as the type,
 * and commit and delete address the slot by category.
 */
describe('DocumentUploader — the type picker', () => {
  it('offers only the types that belong to its category', () => {
    render(<DocumentUploader category="PERSONAL_IDENTITY" document={null} />);

    const options = [...screen.getByLabelText<HTMLSelectElement>('Document type').options]
      .map((option) => option.value)
      .filter(Boolean);
    expect(options).toEqual([...DOC_CATEGORY_TYPES.PERSONAL_IDENTITY]);
    expect(screen.queryByRole('option', { name: DOC_TYPE_LABELS.GST_CERTIFICATE })).toBeNull();
  });

  it('labels the options from contracts', () => {
    render(<DocumentUploader category="BUSINESS_IDENTITY" document={null} />);

    for (const type of DOC_CATEGORY_TYPES.BUSINESS_IDENTITY) {
      expect(screen.getByRole('option', { name: DOC_TYPE_LABELS[type] })).toBeInTheDocument();
    }
  });

  it('says Aadhaar is voluntary when it is chosen', async () => {
    const user = userEvent.setup();
    render(<DocumentUploader category="PERSONAL_IDENTITY" document={null} />);

    await user.selectOptions(screen.getByLabelText('Document type'), 'AADHAAR');
    expect(screen.getByText(/^Voluntary\./)).toBeInTheDocument();
  });

  it('asks for a description only for another government certificate', async () => {
    const user = userEvent.setup();
    render(<DocumentUploader category="BUSINESS_IDENTITY" document={null} />);

    await user.selectOptions(screen.getByLabelText('Document type'), 'UDYAM');
    expect(screen.queryByLabelText('Describe the certificate')).toBeNull();

    await user.selectOptions(screen.getByLabelText('Document type'), 'OTHER_BUSINESS_CERTIFICATE');
    expect(screen.getByLabelText('Describe the certificate')).toBeRequired();
  });

  it('starts on the GST certificate, and warns off anything else, with a GSTIN on file', async () => {
    const user = userEvent.setup();
    render(<DocumentUploader category="BUSINESS_IDENTITY" document={null} gstinOnFile />);

    expect(screen.getByLabelText('Document type')).toHaveValue('GST_CERTIFICATE');
    expect(screen.queryByText(/must be your GST Registration Certificate/)).toBeNull();

    await user.selectOptions(screen.getByLabelText('Document type'), 'UDYAM');
    expect(screen.getByText(/must be your GST Registration Certificate/)).toBeInTheDocument();
  });
});

describe('DocumentUploader — the upload', () => {
  it('will not open the file picker before a type is chosen', async () => {
    const fetchMock = stubFetch();
    const user = userEvent.setup();
    render(<DocumentUploader category="PERSONAL_IDENTITY" document={null} />);

    await user.click(screen.getByRole('button', { name: 'Upload' }));
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Choose which document you are uploading first.',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('will not upload another certificate without a description', async () => {
    const fetchMock = stubFetch();
    const user = userEvent.setup();
    render(<DocumentUploader category="BUSINESS_IDENTITY" document={null} />);

    await user.selectOptions(screen.getByLabelText('Document type'), 'OTHER_BUSINESS_CERTIFICATE');
    await user.upload(screen.getByLabelText('Upload Business Identity Proof'), PDF);

    expect(screen.getByRole('alert')).toHaveTextContent(/Describe the certificate/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('presigns with the category and type, then commits to the category', async () => {
    const fetchMock = stubFetch();
    const user = userEvent.setup();
    render(<DocumentUploader category="PERSONAL_IDENTITY" document={null} />);

    await user.selectOptions(screen.getByLabelText('Document type'), 'PASSPORT');
    await user.upload(screen.getByLabelText('Upload Personal Identity Proof'), PDF);
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      '/api/dealer/documents/presign',
      'https://storage.test/put',
      '/api/dealer/documents/PERSONAL_IDENTITY/commit',
    ]);
    expect(presignBody(fetchMock)).toEqual({
      category: 'PERSONAL_IDENTITY',
      type: 'PASSPORT',
      fileName: 'proof.pdf',
      mimeType: 'application/pdf',
      bytes: PDF.size,
    });
  });

  it('sends the description with another government certificate', async () => {
    const fetchMock = stubFetch();
    const user = userEvent.setup();
    render(<DocumentUploader category="BUSINESS_IDENTITY" document={null} />);

    await user.selectOptions(screen.getByLabelText('Document type'), 'OTHER_BUSINESS_CERTIFICATE');
    await user.type(
      screen.getByLabelText('Describe the certificate'),
      '  Fire safety certificate, Vellore Corporation  ',
    );
    await user.upload(screen.getByLabelText('Upload Business Identity Proof'), PDF);
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    expect(presignBody(fetchMock)).toEqual({
      category: 'BUSINESS_IDENTITY',
      type: 'OTHER_BUSINESS_CERTIFICATE',
      fileName: 'proof.pdf',
      mimeType: 'application/pdf',
      bytes: PDF.size,
      description: 'Fire safety certificate, Vellore Corporation',
    });
  });

  it('uploads through the Sales routes when given their base', async () => {
    const fetchMock = stubFetch();
    const user = userEvent.setup();
    render(
      <DocumentUploader
        category="BUSINESS_IDENTITY"
        document={null}
        gstinOnFile
        basePath="/api/sales/dealers/d-1/documents"
      />,
    );

    await user.upload(screen.getByLabelText('Upload Business Identity Proof'), PDF);
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      '/api/sales/dealers/d-1/documents/presign',
      'https://storage.test/put',
      '/api/sales/dealers/d-1/documents/BUSINESS_IDENTITY/commit',
    ]);
  });

  it('refuses a file over 5 MB before asking for a signature', async () => {
    const fetchMock = stubFetch();
    const user = userEvent.setup();
    render(<DocumentUploader category="BUSINESS_IDENTITY" document={null} gstinOnFile />);

    const large = new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'big.pdf', {
      type: 'application/pdf',
    });
    await user.upload(screen.getByLabelText('Upload Business Identity Proof'), large);

    expect(screen.getByRole('alert')).toHaveTextContent('That file is larger than 5MB.');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('DocumentUploader — what is already there', () => {
  it('shows the file, its type and Replace and Delete', () => {
    render(<DocumentUploader category="BUSINESS_IDENTITY" document={document()} />);

    expect(screen.getByText('gst.pdf')).toBeInTheDocument();
    expect(screen.getByText('In review')).toBeInTheDocument();
    expect(screen.getByLabelText('Document type')).toHaveValue('GST_CERTIFICATE');
    expect(screen.getByRole('button', { name: 'Replace' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
  });

  it('offers no Delete on an empty slot', () => {
    render(<DocumentUploader category="PERSONAL_IDENTITY" document={null} />);

    expect(screen.getByText('Needed to submit')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull();
  });

  it('names the reason a document was rejected', () => {
    render(
      <DocumentUploader
        category="BUSINESS_IDENTITY"
        document={document({
          status: 'REJECTED',
          rejectionReason: 'The scan is too blurry to read.',
        })}
      />,
    );

    expect(screen.getByText('Rejected: The scan is too blurry to read.')).toBeInTheDocument();
  });

  it('prefills the description of another certificate', () => {
    render(
      <DocumentUploader
        category="BUSINESS_IDENTITY"
        document={document({
          type: 'OTHER_BUSINESS_CERTIFICATE',
          description: 'Fire safety certificate, Vellore Corporation',
        })}
      />,
    );

    expect(screen.getByLabelText('Describe the certificate')).toHaveValue(
      'Fire safety certificate, Vellore Corporation',
    );
  });

  it('deletes the slot by category', async () => {
    const fetchMock = stubFetch();
    const user = userEvent.setup();
    const refreshed = navigationState.refreshed;
    render(
      <DocumentUploader
        category="PERSONAL_IDENTITY"
        document={document({ category: 'PERSONAL_IDENTITY', type: 'PAN_CARD' })}
        basePath="/api/sales/dealers/d-1/documents"
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => {
      expect(navigationState.refreshed).toBe(refreshed + 1);
    });

    expect(fetchMock).toHaveBeenCalledWith('/api/sales/dealers/d-1/documents/PERSONAL_IDENTITY', {
      method: 'DELETE',
    });
  });
});
