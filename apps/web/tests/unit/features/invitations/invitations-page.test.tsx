import type { MyInvitationsResponse } from '@dealers-drive/contracts';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import InvitationsPage from '@/app/(public)/invitations/page';
import { acceptInvitationAction, declineInvitationAction } from '@/features/invitations/actions';
import { ApiError } from '@/lib/api';
import type * as ApiModule from '@/lib/api';

/**
 * R94 — the invited person's side. Signed in with the ordinary customer OTP,
 * they see the dealerships that invited their number and accept with the
 * session they already have. A visitor who is not signed in is sent to log in
 * and brought back.
 */
const apiGetParsed = vi.fn();

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof ApiModule>();
  return { ...actual, apiGetParsed: (...args: unknown[]) => apiGetParsed(...args) as unknown };
});
vi.mock('@/features/invitations/actions', () => ({
  acceptInvitationAction: vi.fn(),
  declineInvitationAction: vi.fn(),
}));

const WAITING: MyInvitationsResponse = {
  data: [
    {
      id: '44444444-4444-4444-8444-444444444444',
      dealer: { brandName: 'ABC Motors', city: 'Vellore' },
      role: 'STAFF',
      roleLabel: 'Staff',
      invitedByName: 'Shashikiran',
      expiresAt: '2026-10-09T09:30:00.000Z',
      expiresLabel: '9 Oct 2026',
    },
  ],
};

beforeEach(() => {
  apiGetParsed.mockReset().mockResolvedValue(WAITING);
  vi.mocked(acceptInvitationAction).mockReset().mockResolvedValue({ ok: true });
  vi.mocked(declineInvitationAction).mockReset().mockResolvedValue({ ok: true });
});

describe('the invitations page', () => {
  it('names the dealership, the role and who invited them', async () => {
    render(await InvitationsPage());
    const item = within(screen.getByRole('list', { name: 'Invitations' })).getByRole('listitem');
    expect(item).toHaveTextContent('ABC Motors');
    expect(item).toHaveTextContent('Vellore');
    expect(item).toHaveTextContent('Invited as Staff');
    expect(item).toHaveTextContent('by Shashikiran');
  });

  it('accepts with the session they have', async () => {
    const user = userEvent.setup();
    render(await InvitationsPage());
    await user.click(screen.getByRole('button', { name: 'Accept and open dealer dashboard' }));
    expect(acceptInvitationAction).toHaveBeenCalledWith('44444444-4444-4444-8444-444444444444');
  });

  it('declines, and shows a refusal when there is one', async () => {
    vi.mocked(declineInvitationAction).mockResolvedValue({ ok: false, message: 'Expired.' });
    const user = userEvent.setup();
    render(await InvitationsPage());
    await user.click(screen.getByRole('button', { name: 'Decline' }));
    expect(declineInvitationAction).toHaveBeenCalledWith('44444444-4444-4444-8444-444444444444');
    expect(await screen.findByText('Expired.')).toBeInTheDocument();
  });

  it('says so when nothing is waiting', async () => {
    apiGetParsed.mockResolvedValue({ data: [] });
    render(await InvitationsPage());
    expect(screen.getByText('No invitations waiting')).toBeInTheDocument();
  });

  it('sends a visitor who is not signed in to log in and back', async () => {
    apiGetParsed.mockRejectedValue(
      new ApiError({
        type: 'about:blank',
        title: 'Unauthorized',
        status: 401,
        code: 'UNAUTHORIZED',
      }),
    );
    await expect(InvitationsPage()).rejects.toThrow('NEXT_REDIRECT:/login?returnTo=%2Finvitations');
  });
});
