import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { navigationState } from '../../../setup';

import { CustomerContactApproval } from '@/features/admin/customer-contact-approval';

const approveCustomerContactAction = vi.fn();

vi.mock('@/features/admin/actions', () => ({
  approveCustomerContactAction: (id: string) => approveCustomerContactAction(id) as unknown,
}));

const DEALER_ID = '3c8f2b10-2222-4000-8000-000000000002';

beforeEach(() => {
  approveCustomerContactAction.mockReset();
});

describe('CustomerContactApproval', () => {
  it('offers to approve a saved number that is not approved yet, then refreshes', async () => {
    const user = userEvent.setup();
    approveCustomerContactAction.mockResolvedValue({ ok: true });
    render(
      <CustomerContactApproval dealerId={DEALER_ID} landline="9677902626" approvedAt={null} />,
    );

    expect(screen.getByText('+91 96779 02626')).toBeVisible();
    expect(screen.getByText(/Not approved for calls/)).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Approve for calls' }));

    expect(approveCustomerContactAction).toHaveBeenCalledWith(DEALER_ID);
    await waitFor(() => expect(navigationState.refreshed).toBe(1));
  });

  it('says when it was approved, with nothing left to press', () => {
    render(
      <CustomerContactApproval
        dealerId={DEALER_ID}
        landline="+919677902626"
        approvedAt="2026-10-30T09:15:00.000Z"
      />,
    );
    expect(screen.getByText('Approved for calls on 30 Oct 2026')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Approve for calls' })).not.toBeInTheDocument();
  });

  it('shows the refusal when the approval fails', async () => {
    const user = userEvent.setup();
    approveCustomerContactAction.mockResolvedValue({
      ok: false,
      message: 'This dealership has no valid customer contact number to approve.',
    });
    render(
      <CustomerContactApproval dealerId={DEALER_ID} landline="9677902626" approvedAt={null} />,
    );

    await user.click(screen.getByRole('button', { name: 'Approve for calls' }));

    expect(await screen.findByText(/no valid customer contact number/)).toBeVisible();
    expect(navigationState.refreshed).toBe(0);
  });

  it('asks for a number, or a valid one, before it can be approved', () => {
    const { rerender } = render(
      <CustomerContactApproval dealerId={DEALER_ID} landline={null} approvedAt={null} />,
    );
    expect(screen.getByText(/No customer contact number is saved/)).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Approve for calls' })).not.toBeInTheDocument();

    rerender(
      <CustomerContactApproval dealerId={DEALER_ID} landline="call the yard" approvedAt={null} />,
    );
    expect(screen.getByText('call the yard')).toBeVisible();
    expect(screen.getByText(/not a valid Indian mobile or landline/)).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Approve for calls' })).not.toBeInTheDocument();
  });
});
