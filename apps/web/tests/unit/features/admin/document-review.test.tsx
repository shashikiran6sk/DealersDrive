import type { AdminDealerDetail, AdminDealerDocument } from '@dealers-drive/contracts';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DocumentReview } from '@/features/admin/document-review';

const rejectDocumentAction = vi.fn();
vi.mock('@/features/admin/actions', () => ({
  verifyDocumentAction: vi.fn(),
  rejectDocumentAction: (...args: unknown[]) => rejectDocumentAction(...args) as unknown,
}));

/**
 * ADMIN-MOBILE-DETAIL-001. An uploaded document's row carries its label, View,
 * Verify, Reject file and a status tag. On one line that is wider than a
 * 320 px card, so the tag ran 22 px off the screen. The row wraps instead.
 * jsdom cannot measure layout; the browser geometry check is in the campaign
 * evidence.
 */
const UPLOADED: AdminDealerDocument = {
  id: '7f3c9a21-4444-4000-8000-000000000004',
  category: 'BUSINESS_IDENTITY',
  categoryLabel: 'Business Identity Proof',
  type: 'GST_CERTIFICATE',
  label: 'GST certificate',
  status: 'UPLOADED',
  fileName: 'gst.pdf',
  mimeType: 'application/pdf',
  description: null,
  bytes: 2048,
  uploadedAt: '2026-10-01T09:00:00.000Z',
  reviewedAt: null,
  submissionCount: 1,
  viewUrl: 'https://storage.test/signed/gst.pdf',
  viewUrlExpiresAt: '2026-10-01T09:05:00.000Z',
  rejectionReason: null,
};

const VERIFIED_PAN: AdminDealerDocument = {
  ...UPLOADED,
  id: '7f3c9a21-4444-4000-8000-000000000005',
  category: 'PERSONAL_IDENTITY',
  categoryLabel: 'Personal Identity Proof',
  type: 'PAN_CARD',
  label: 'PAN Card',
  status: 'VERIFIED',
  fileName: 'pan.jpg',
  mimeType: 'image/jpeg',
  reviewedAt: '2026-10-02T09:00:00.000Z',
  submissionCount: 2,
};

const OTHER: AdminDealerDocument = {
  ...UPLOADED,
  id: '7f3c9a21-4444-4000-8000-000000000006',
  type: 'OTHER_BUSINESS_CERTIFICATE',
  label: 'Other Government-Issued Business Certificate',
  description: 'Panchayat trade licence issued by Katpadi panchayat',
};

const HISTORY: AdminDealerDetail['documentHistory'] = [
  {
    at: '2026-10-02T09:00:00.000Z',
    action: 'REJECTED',
    category: 'PERSONAL_IDENTITY',
    type: 'PAN_CARD',
    reason: 'The scan is cropped.',
    actorType: 'ADMIN',
  },
  {
    at: '2026-10-01T09:00:00.000Z',
    action: 'SUBMITTED',
    category: 'PERSONAL_IDENTITY',
    type: 'PAN_CARD',
    reason: null,
    actorType: 'DEALER',
  },
];

describe('the document review row on a phone', () => {
  it('lets the decision controls wrap under the label', () => {
    render(<DocumentReview documents={[UPLOADED]} dealerSlug="sri-lakshmi-motors" />);

    const row = screen.getByText('GST certificate').parentElement;
    expect(row).toHaveClass('flex', 'flex-wrap');
    expect(screen.getByRole('button', { name: 'Verify' })).toBeInTheDocument();
  });
});

/**
 * #299. Documents are reviewed per category — Personal Identity Proof, then
 * Business Identity Proof — with what is still outstanding, every submission
 * and decision, and a revocation for a verification that no longer stands.
 */
describe('document review by category', () => {
  beforeEach(() => rejectDocumentAction.mockReset().mockResolvedValue({ ok: true }));

  it('groups documents under their category headings, personal first', () => {
    render(<DocumentReview documents={[UPLOADED, VERIFIED_PAN]} dealerSlug="sri-lakshmi-motors" />);

    const headings = screen.getAllByRole('heading', { level: 3 }).map((node) => node.textContent);
    expect(headings).toEqual(['Personal Identity Proof', 'Business Identity Proof']);
  });

  it('says when a category has nothing submitted yet', () => {
    render(<DocumentReview documents={[UPLOADED]} dealerSlug="sri-lakshmi-motors" />);

    expect(screen.getByText('Nothing submitted in this category yet.')).toBeInTheDocument();
  });

  it('shows the file facts, submission count and the description of another certificate', () => {
    render(<DocumentReview documents={[VERIFIED_PAN, OTHER]} dealerSlug="sri-lakshmi-motors" />);

    expect(screen.getByText(/pan\.jpg · 2\.0 KB · JPEG · 2 submissions/)).toBeInTheDocument();
    expect(
      screen.getByText('Described as: Panchayat trade licence issued by Katpadi panchayat'),
    ).toBeInTheDocument();
  });

  it('lists what is still outstanding', () => {
    render(
      <DocumentReview
        documents={[UPLOADED]}
        dealerSlug="sri-lakshmi-motors"
        gaps={['PERSONAL_IDENTITY', 'GST_CERTIFICATE']}
      />,
    );

    const list = screen.getByText('Still outstanding for standard approval').nextElementSibling;
    expect(list).not.toBeNull();
    const items = within(list as HTMLElement).getAllByRole('listitem');
    expect(items.map((item) => item.textContent)).toEqual([
      'Personal Identity Proof',
      'GST Registration Certificate (a GSTIN is on file)',
    ]);
  });

  it('shows each submission and decision in the review history', () => {
    render(
      <DocumentReview
        documents={[VERIFIED_PAN]}
        dealerSlug="sri-lakshmi-motors"
        history={HISTORY}
      />,
    );

    expect(screen.getByText('Review history (2)')).toBeInTheDocument();
    expect(screen.getByText('The scan is cropped.')).toBeInTheDocument();
    expect(screen.getByText(/by dealer/)).toBeInTheDocument();
  });

  it('offers no verify or reject on a verified document, only a revocation', () => {
    render(<DocumentReview documents={[VERIFIED_PAN]} dealerSlug="sri-lakshmi-motors" />);

    expect(screen.queryByRole('button', { name: 'Verify' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Reject file' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Revoke verification' })).toBeInTheDocument();
  });

  it('revokes a verification only with a reason, and says the dealer must resubmit', async () => {
    const user = userEvent.setup();
    render(<DocumentReview documents={[VERIFIED_PAN]} dealerSlug="sri-lakshmi-motors" />);

    await user.click(screen.getByRole('button', { name: 'Revoke verification' }));
    const confirm = screen.getByRole('button', { name: 'Revoke and ask for a new file' });
    expect(confirm).toBeDisabled();
    expect(screen.getByText(/asked to submit this category again/)).toBeInTheDocument();

    await user.type(
      screen.getByLabelText('Reason for revoking the verification of PAN Card'),
      'The PAN on file belongs to a different person.',
    );
    await user.click(confirm);

    expect(rejectDocumentAction).toHaveBeenCalledWith(
      VERIFIED_PAN.id,
      { reason: 'The PAN on file belongs to a different person.' },
      'sri-lakshmi-motors',
    );
  });
});
