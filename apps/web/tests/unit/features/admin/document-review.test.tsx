import type { AdminDealerDocument } from '@dealers-drive/contracts';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { DocumentReview } from '@/features/admin/document-review';

vi.mock('@/features/admin/actions', () => ({
  verifyDocumentAction: vi.fn(),
  rejectDocumentAction: vi.fn(),
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
  type: 'GST_CERTIFICATE',
  label: 'GST certificate',
  status: 'UPLOADED',
  fileName: 'gst.pdf',
  bytes: 2048,
  uploadedAt: '2026-10-01T09:00:00.000Z',
  viewUrl: 'https://storage.test/signed/gst.pdf',
  viewUrlExpiresAt: '2026-10-01T09:05:00.000Z',
  rejectionReason: null,
};

describe('the document review row on a phone', () => {
  it('lets the decision controls wrap under the label', () => {
    render(<DocumentReview documents={[UPLOADED]} dealerSlug="sri-lakshmi-motors" />);

    const row = screen.getByText('GST certificate').parentElement;
    expect(row).toHaveClass('flex', 'flex-wrap');
    expect(screen.getByRole('button', { name: 'Verify' })).toBeInTheDocument();
  });
});
