import type { AdminDealerDetail } from '@dealers-drive/contracts';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DealerAdminActions } from '@/features/admin/dealer-actions';

const approveDealerAction = vi.fn();
vi.mock('@/features/admin/actions', () => ({
  approveDealerAction: (...args: unknown[]) => approveDealerAction(...args) as unknown,
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
