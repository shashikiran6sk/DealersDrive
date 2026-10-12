import type { DealerPortfolioPhoto } from '@dealers-drive/contracts';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DealerPortfolioSummary } from '@/features/admin/dealer-portfolio-summary';

const takeDownPortfolioPhotoAction = vi.fn();
vi.mock('@/features/admin/portfolio-actions', () => ({
  takeDownPortfolioPhotoAction: (...args: unknown[]) =>
    takeDownPortfolioPhotoAction(...args) as unknown,
}));

const APPROVED: DealerPortfolioPhoto = {
  id: '9b2e4d10-3333-4000-8000-000000000001',
  status: 'APPROVED',
  statusLabel: 'Approved — shown on your page',
  previewUrl: 'https://storage.test/signed/portfolio-1.jpg',
  caption: 'Our showroom on Katpadi Road',
  replacesId: null,
  position: 0,
  rejectionReason: null,
  submittedAt: '2026-10-01T09:00:00.000Z',
  reviewedAt: '2026-10-02T09:00:00.000Z',
};

const PENDING: DealerPortfolioPhoto = {
  ...APPROVED,
  id: '9b2e4d10-3333-4000-8000-000000000002',
  status: 'PENDING',
  statusLabel: 'Awaiting review — not public yet',
  caption: null,
  position: 1,
  reviewedAt: null,
};

describe('the portfolio summary on the admin dealer page', () => {
  beforeEach(() => takeDownPortfolioPhotoAction.mockReset().mockResolvedValue({ ok: true }));

  it('shows thumbnails, status and caption, and links to the queue', () => {
    render(<DealerPortfolioSummary photos={[APPROVED, PENDING]} dealerSlug="chennai-cars" />);

    expect(screen.getByRole('img', { name: 'Our showroom on Katpadi Road' })).toHaveAttribute(
      'src',
      APPROVED.previewUrl,
    );
    expect(screen.getByText('Approved — public')).toBeInTheDocument();
    expect(screen.getByText('Awaiting review')).toBeInTheDocument();
    expect(screen.getByText('1 approved · 1 awaiting review')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open the portfolio queue' })).toHaveAttribute(
      'href',
      '/admin/portfolio',
    );
  });

  it('offers a take-down on approved photographs only', () => {
    render(<DealerPortfolioSummary photos={[APPROVED, PENDING]} dealerSlug="chennai-cars" />);

    expect(screen.getAllByRole('button', { name: 'Take down' })).toHaveLength(1);
  });

  it('takes a photograph down only with a reason', async () => {
    const user = userEvent.setup();
    render(<DealerPortfolioSummary photos={[APPROVED]} dealerSlug="chennai-cars" />);

    await user.click(screen.getByRole('button', { name: 'Take down' }));
    const confirm = screen.getByRole('button', { name: 'Take down photograph' });
    expect(confirm).toBeDisabled();

    await user.type(
      screen.getByLabelText('Reason for taking down photograph 1'),
      'Shows a number plate.',
    );
    await user.click(confirm);

    expect(takeDownPortfolioPhotoAction).toHaveBeenCalledWith(
      APPROVED.id,
      'Shows a number plate.',
      'chennai-cars',
    );
  });

  it('says when there is nothing to show', () => {
    render(<DealerPortfolioSummary photos={[]} dealerSlug="chennai-cars" />);

    expect(screen.getByText('No portfolio photographs submitted.')).toBeInTheDocument();
  });
});
