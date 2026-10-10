import type { AdminDealerDetail } from '@dealers-drive/contracts';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DealerAdminActions } from '@/features/admin/dealer-actions';

const approveDealerAction = vi.fn();
const closeDealerAction = vi.fn();
vi.mock('@/features/admin/actions', () => ({
  approveDealerAction: (...args: unknown[]) => approveDealerAction(...args) as unknown,
  closeDealerAction: (...args: unknown[]) => closeDealerAction(...args) as unknown,
  reinstateDealerAction: vi.fn(),
  rejectDealerAction: vi.fn(),
  requestDealerChangesAction: vi.fn(),
  suspendDealerAction: vi.fn(),
}));

// Only the moderation controls' inputs; other detail fields are never read here.
const DEALER = {
  id: '3c8f2b10-2222-4000-8000-000000000002',
  slug: 'chennai-cars',
  brandName: 'Chennai cars',
  status: 'PENDING_APPROVAL',
  gstin: '33AABCS1429B1ZX',
  actions: { canApprove: true },
} as AdminDealerDetail;

describe('dealer approval confirmation', () => {
  beforeEach(() => approveDealerAction.mockReset().mockResolvedValue({ ok: true }));

  it('requires the action and the dealership name before enabling approval', async () => {
    const user = userEvent.setup();
    render(<DealerAdminActions dealer={DEALER} />);
    const button = screen.getByRole('button', { name: 'Approve dealer' });
    const confirmation = screen.getByLabelText(/confirm approval/i);
    expect(button).toBeDisabled();
    for (const value of ['approve', 'Chennai cars', 'approve other cars']) {
      await user.clear(confirmation);
      await user.type(confirmation, value);
      expect(button).toBeDisabled();
    }
    await user.clear(confirmation);
    await user.type(confirmation, 'approve chennai cars');
    expect(button).toBeEnabled();
    await user.click(button);
    expect(approveDealerAction).toHaveBeenCalledWith(DEALER.id, {}, DEALER.slug);
    expect(confirmation).toHaveValue('');
    expect(button).toBeDisabled();
  });

  it('requires and sends an explicit applicability review when GSTIN is absent', async () => {
    const user = userEvent.setup();
    const view = render(<DealerAdminActions dealer={{ ...DEALER, gstin: null }} />);
    await user.type(screen.getByLabelText(/confirm approval/i), 'approve chennai cars');
    const button = screen.getByRole('button', { name: 'Approve dealer' });
    expect(button).toBeDisabled();
    await user.type(
      screen.getByLabelText(/GST registration applicability review/),
      'Synthetic reviewed non-requirement case QA-11.',
    );
    expect(button).toBeEnabled();
    await user.click(button);
    expect(approveDealerAction).toHaveBeenCalledWith(
      DEALER.id,
      { gstNotRequiredReview: 'Synthetic reviewed non-requirement case QA-11.' },
      DEALER.slug,
    );
    view.rerender(
      <DealerAdminActions
        dealer={{ ...DEALER, id: 'another', gstin: null, brandName: 'Madurai Cars' }}
      />,
    );
    expect(screen.getByLabelText(/GST registration applicability review/)).toHaveValue('');
  });

  it('accepts case differences and outer spaces', async () => {
    const user = userEvent.setup();
    render(<DealerAdminActions dealer={DEALER} />);
    await user.type(screen.getByLabelText(/confirm approval/i), '  APPROVE Chennai Cars  ');
    expect(screen.getByRole('button', { name: 'Approve dealer' })).toBeEnabled();
  });

  it('still requires document verification even with the correct phrase', async () => {
    const user = userEvent.setup();
    render(
      <DealerAdminActions
        dealer={{ ...DEALER, actions: { ...DEALER.actions, canApprove: false } }}
      />,
    );
    await user.type(screen.getByLabelText(/confirm approval/i), 'approve chennai cars');
    const button = screen.getByRole('button', { name: 'Approve dealer' });
    expect(button).toBeDisabled();
    await user.click(button);
    expect(approveDealerAction).not.toHaveBeenCalled();
  });

  it('uses the currently displayed dealership name', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<DealerAdminActions dealer={DEALER} />);
    await user.type(screen.getByLabelText(/confirm approval/i), 'approve chennai cars');
    rerender(
      <DealerAdminActions dealer={{ ...DEALER, id: 'another', brandName: 'Madurai Cars' }} />,
    );
    expect(screen.getByRole('button', { name: 'Approve dealer' })).toBeDisabled();
    expect(screen.getByText(/type “approve madurai cars”/i)).toBeInTheDocument();
  });
});

/**
 * ORIG-GAP-CLOSE. Close is offered exactly where the API says it is — DRAFT
 * and PENDING_APPROVAL — needs a reason, and says plainly that nothing is
 * deleted, because the destructive alternative sits right below it.
 */
describe('closing an application', () => {
  beforeEach(() => closeDealerAction.mockReset().mockResolvedValue({ ok: true }));

  it('closes with the typed reason once the reason is long enough', async () => {
    const user = userEvent.setup();
    render(
      <DealerAdminActions
        dealer={{ ...DEALER, status: 'DRAFT', actions: { ...DEALER.actions, canClose: true } }}
      />,
    );
    const button = screen.getByRole('button', { name: 'Close application' });
    expect(button).toBeDisabled();
    expect(screen.getByText(/without deleting anything/)).toBeInTheDocument();

    await user.type(screen.getByLabelText('Reason for closing'), '  Duplicate application  ');
    await user.click(button);

    expect(closeDealerAction).toHaveBeenCalledWith(
      DEALER.id,
      { reason: 'Duplicate application' },
      DEALER.slug,
    );
    expect(await screen.findByText('Application closed. Nothing was deleted.')).toBeInTheDocument();
  });

  it('is not offered when the API does not offer it', () => {
    render(
      <DealerAdminActions
        dealer={{ ...DEALER, status: 'ACTIVE', actions: { ...DEALER.actions, canClose: false } }}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Close application' })).toBeNull();
  });
});
