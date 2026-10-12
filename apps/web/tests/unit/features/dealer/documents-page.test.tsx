import type {
  DealerDocumentDto,
  DealerDocumentsResponse,
  DealerProfile,
} from '@dealers-drive/contracts';
import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import DealerDocumentsPage from '@/app/(dealer)/dealer/documents/page';
import { consoleNavFor } from '@/components/dealer/console-nav';
import { DocumentsOverview } from '@/features/dealer/documents-overview';
import type * as ApiModule from '@/lib/api';

/**
 * L8 — the owner's Documents page at `/dealer/documents`. A dealership a
 * Super admin activated before its documents were verified lands here from
 * the "upload your documents" email; a standard dealership sees its verified
 * documents. The dealer-facing payloads carry no `activationMethod`, so the
 * page judges by what is outstanding, against the same rule approval and
 * Dealer Verified use (`documentRequirement` with `isVerifiedDocument`).
 */
const apiGetParsed = vi.fn();
const currentSession = vi.fn();

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof ApiModule>();
  return { ...actual, apiGetParsed: (...args: unknown[]) => apiGetParsed(...args) as unknown };
});
vi.mock('@/lib/session', () => ({ currentSession: () => currentSession() as unknown }));

function document(overrides: Partial<DealerDocumentDto> = {}): DealerDocumentDto {
  return {
    id: '00000000-0000-4000-8000-0000000000d1',
    category: 'PERSONAL_IDENTITY',
    categoryLabel: 'Personal Identity Proof',
    type: 'PAN_CARD',
    label: 'PAN Card',
    status: 'VERIFIED',
    statusLabel: 'Verified',
    fileName: 'pan.pdf',
    mimeType: 'application/pdf',
    bytes: 2048,
    description: null,
    uploadedAt: '2026-10-12T09:00:00.000Z',
    reviewedAt: '2026-10-13T09:00:00.000Z',
    rejectionReason: null,
    submissionCount: 1,
    action: 'Replace',
    ...overrides,
  };
}

const PERSONAL_VERIFIED = document();
const BUSINESS_VERIFIED = document({
  id: '00000000-0000-4000-8000-0000000000d2',
  category: 'BUSINESS_IDENTITY',
  categoryLabel: 'Business Identity Proof',
  type: 'UDYAM',
  label: 'Udyam Registration Certificate',
  fileName: 'udyam.pdf',
});
const BUSINESS_REJECTED = document({
  ...BUSINESS_VERIFIED,
  status: 'REJECTED',
  statusLabel: 'Rejected — upload a replacement',
  rejectionReason: 'The scan is too blurry to read.',
  action: 'Resubmit',
});

function documentsResponse(data: DealerDocumentDto[]): DealerDocumentsResponse {
  return { data, slots: [], requirementMet: false, gaps: [], allVerified: false };
}

const OWNER_SESSION = { permissions: ['document:upload', 'dealer:update', 'vehicle:read'] };

function stubApi(data: DealerDocumentDto[], gstin: string | null = null) {
  apiGetParsed.mockImplementation((_schema: unknown, path: string) => {
    if (path === '/v1/dealer/documents') return Promise.resolve(documentsResponse(data));
    if (path === '/v1/dealer') {
      const dealer: Pick<DealerProfile, 'status' | 'gstin'> = { status: 'ACTIVE', gstin };
      return Promise.resolve(dealer);
    }
    return Promise.reject(new Error(`unexpected ${path}`));
  });
}

beforeEach(() => {
  apiGetParsed.mockReset();
  currentSession.mockReset().mockResolvedValue(OWNER_SESSION);
});

describe('who sees the Documents page', () => {
  it('sends a member who may not upload documents to the dashboard, and asks for nothing', async () => {
    currentSession.mockResolvedValue({ permissions: ['vehicle:read', 'enquiry:read'] });

    await expect(DealerDocumentsPage()).rejects.toThrow('NEXT_REDIRECT:/dealer');
    expect(apiGetParsed).not.toHaveBeenCalled();
  });

  it('puts Documents in the console nav for an owner only', () => {
    const owner = consoleNavFor(['document:upload']);
    expect(owner.map((item) => item.label)).toContain('Documents');
    expect(owner.find((item) => item.label === 'Documents')?.href).toBe('/dealer/documents');
    expect(consoleNavFor(['vehicle:read', 'enquiry:read']).map((item) => item.label)).not.toContain(
      'Documents',
    );
  });
});

describe('the Documents page', () => {
  it('reads the documents and the dealership, and renders an uploader per category', async () => {
    stubApi([PERSONAL_VERIFIED, BUSINESS_VERIFIED]);
    render(await DealerDocumentsPage());

    expect(apiGetParsed).toHaveBeenCalledWith(expect.anything(), '/v1/dealer/documents', {
      revalidate: false,
    });
    expect(apiGetParsed).toHaveBeenCalledWith(expect.anything(), '/v1/dealer', {
      revalidate: false,
    });
    expect(screen.getByRole('heading', { level: 1, name: 'Your documents' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Personal Identity Proof' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Business Identity Proof' })).toBeInTheDocument();
  });

  it('says the documents are verified when nothing is outstanding', async () => {
    stubApi([PERSONAL_VERIFIED, BUSINESS_VERIFIED]);
    render(await DealerDocumentsPage());

    expect(screen.getByText('Your documents are verified.')).toBeInTheDocument();
    expect(screen.queryByText('Documents still to be verified')).toBeNull();
    expect(screen.queryByText(/activation withdrawn/)).toBeNull();
    expect(screen.getByText(/Dealer Verified is a separate review/)).toBeInTheDocument();
  });

  it('offers no Replace or Delete on a document the API has locked', async () => {
    stubApi([PERSONAL_VERIFIED, BUSINESS_VERIFIED]);
    render(await DealerDocumentsPage());

    const personal = screen.getByRole('region', { name: 'Personal Identity Proof' });
    expect(within(personal).queryByRole('button', { name: 'Replace' })).toBeNull();
    expect(within(personal).queryByRole('button', { name: 'Delete' })).toBeNull();
    expect(within(personal).getByText(/can no longer be changed here/)).toBeInTheDocument();
  });
});

describe('DocumentsOverview', () => {
  it('names both outstanding categories and explains an activation ahead of verification', () => {
    render(<DocumentsOverview documents={[]} gstin={null} dealerStatus="ACTIVE" />);

    expect(screen.getByText('Documents still to be verified')).toBeInTheDocument();
    const items = screen.getAllByRole('listitem').map((item) => item.textContent);
    expect(items).toEqual(['Personal Identity Proof', 'Business Identity Proof']);
    expect(screen.getByText(/activation withdrawn if they cannot be produced/)).toBeInTheDocument();
    expect(screen.queryByText('Your documents are verified.')).toBeNull();
    expect(screen.getAllByRole('button', { name: 'Upload' })).toHaveLength(2);
    expect(screen.getAllByText('Not uploaded yet')).toHaveLength(2);
    expect(screen.queryByText('Needed to submit')).toBeNull();
  });

  it('names a rejected category, and lets the dealer replace it', () => {
    render(
      <DocumentsOverview
        documents={[PERSONAL_VERIFIED, BUSINESS_REJECTED]}
        gstin={null}
        dealerStatus="ACTIVE"
      />,
    );

    const items = screen.getAllByRole('listitem').map((item) => item.textContent);
    expect(items).toEqual(['Business Identity Proof']);
    const business = screen.getByRole('region', { name: 'Business Identity Proof' });
    expect(within(business).getByRole('button', { name: 'Replace' })).toBeInTheDocument();
    expect(within(business).getByText(/too blurry/)).toBeInTheDocument();
  });

  it('counts a document still in review as outstanding, not verified', () => {
    render(
      <DocumentsOverview
        documents={[
          PERSONAL_VERIFIED,
          { ...BUSINESS_VERIFIED, status: 'UPLOADED', statusLabel: 'In review' },
        ]}
        gstin={null}
        dealerStatus="ACTIVE"
      />,
    );

    expect(screen.getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'Business Identity Proof',
    ]);
  });

  it('keeps the activation sentence to a live dealership', () => {
    render(<DocumentsOverview documents={[]} gstin={null} dealerStatus="SUSPENDED" />);

    expect(screen.getByText('Documents still to be verified')).toBeInTheDocument();
    expect(screen.queryByText(/activation withdrawn/)).toBeNull();
  });
});
