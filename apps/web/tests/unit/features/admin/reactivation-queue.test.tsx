import type { AdminReactivationRow, AdminReactivationsResponse } from '@dealers-drive/contracts';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ReactivationQueue, type ReactivationDecide } from '@/features/admin/moderation-queue';

/**
 * The admin's side of a reactivation request: approve (the listing goes back
 * to Active) or decline (it stays where it is), each behind a confirmation, with
 * an optional note the dealer sees.
 */
const ROW: AdminReactivationRow = {
  id: '55555555-5555-4555-8555-555555555555',
  status: 'PENDING',
  statusLabel: 'Reactivation pending approval',
  statusTone: 'warn',
  fromStatus: 'RESERVED',
  fromStatusLabel: 'Reserved',
  toStatus: 'ACTIVE',
  toStatusLabel: 'Active',
  reason: null,
  requestedAt: '2026-09-29T09:00:00.000Z',
  requestedLabel: '29 Sep 2026',
  reviewedAt: null,
  adminNote: null,
  listing: {
    id: '11111111-1111-4111-8111-111111111111',
    vehicleId: '22222222-2222-4222-8222-222222222222',
    title: '2019 Honda City VX',
    registrationDisplay: 'TN 09 BX 0001',
    status: 'RESERVED',
    statusLabel: 'Reserved',
    statusTone: 'warn',
    slug: '2019-honda-city-abc',
  },
  dealer: { id: '33333333-3333-4333-8333-333333333333', name: 'Sri Lakshmi Motors', slug: 'sri' },
  current: true,
};

function queue(
  overrides: Partial<AdminReactivationsResponse> = {},
  approve: ReactivationDecide = vi.fn(),
  reject: ReactivationDecide = vi.fn(),
) {
  const requests: AdminReactivationsResponse = {
    status: 'PENDING',
    data: [ROW],
    page: { nextCursor: null, hasMore: false },
    counts: { PENDING: 1 },
    ...overrides,
  };
  return render(
    <ReactivationQueue
      requests={requests}
      listingCounts={{ RESERVED: 3 }}
      approve={approve}
      reject={reject}
    />,
  );
}

describe('ReactivationQueue', () => {
  it('approves after a confirmation, with no note required', async () => {
    const approve = vi.fn<ReactivationDecide>(() => Promise.resolve({ ok: true }));
    queue({}, approve);
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
    const dialog = await screen.findByRole('dialog', { name: 'Put this car back on sale?' });
    expect(approve).not.toHaveBeenCalled();
    const confirm = within(dialog).getByRole('button', { name: 'Approve and reactivate' });
    expect(confirm).toBeEnabled();
    fireEvent.click(confirm);
    await waitFor(() => expect(approve).toHaveBeenCalledWith(ROW.id, ''));
  });

  it('declines with the note the dealer will see', async () => {
    const reject = vi.fn<ReactivationDecide>(() => Promise.resolve({ ok: true }));
    queue({}, vi.fn(), reject);
    fireEvent.click(screen.getByRole('button', { name: 'Decline' }));
    const dialog = await screen.findByRole('dialog', { name: 'Decline this request?' });
    fireEvent.change(within(dialog).getByLabelText(/Note to the dealer/), {
      target: { value: '  Still with the bank. ' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Decline request' }));
    await waitFor(() => expect(reject).toHaveBeenCalledWith(ROW.id, 'Still with the bank.'));
  });

  it('keeps the dialog open and shows a refusal, such as a stale request', async () => {
    const approve = vi.fn<ReactivationDecide>(() =>
      Promise.resolve({
        ok: false,
        message: 'The listing has changed since this request was made, so it cannot be approved.',
      }),
    );
    queue({}, approve);
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Approve and reactivate' }));
    expect(await within(dialog).findByText(/cannot be approved/)).toBeInTheDocument();
  });

  it('shows a decided request’s outcome and note instead of the decisions', () => {
    queue({
      status: 'REJECTED',
      data: [
        {
          ...ROW,
          status: 'REJECTED',
          statusLabel: 'Reactivation declined',
          statusTone: 'err',
          reviewedAt: '2026-09-30T09:00:00.000Z',
          adminNote: 'Still with the bank.',
        },
      ],
    });
    expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument();
    const table = within(screen.getByRole('table'));
    expect(table.getByText('Reactivation declined')).toBeInTheDocument();
    expect(table.getByText(/Still with the bank\./)).toBeInTheDocument();
    expect(table.getByText('No note from the dealer')).toBeInTheDocument();
  });

  it('filters by request status, pending by default', () => {
    queue();
    const tabs = within(screen.getByRole('navigation', { name: 'Filter reactivation requests' }));
    expect(tabs.getByRole('link', { name: /Pending/ })).toHaveAttribute('aria-current', 'page');
    expect(tabs.getByRole('link', { name: /Declined/ })).toHaveAttribute(
      'href',
      '/admin/listings?view=reactivation&status=REJECTED',
    );
  });
});
