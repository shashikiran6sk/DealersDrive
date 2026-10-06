import type { AdminMemberDto } from '@dealers-drive/contracts';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AdminMembers } from '@/features/admin/admin-members';
import {
  activateMemberAction,
  changeMemberRoleAction,
  disableMemberAction,
  inviteMemberAction,
} from '@/features/admin/member-actions';

vi.mock('@/features/admin/member-actions', () => ({
  inviteMemberAction: vi.fn(() => Promise.resolve({ ok: true, member: { email: 'x@y.in' } })),
  changeMemberRoleAction: vi.fn(() => Promise.resolve({ ok: true })),
  disableMemberAction: vi.fn(() => Promise.resolve({ ok: true })),
  activateMemberAction: vi.fn(() => Promise.resolve({ ok: true })),
}));

/**
 * R111 — the Members screen. The API is the authorization; what this screen
 * owes the Super admin is to offer only what the API will accept, and to say
 * why a row cannot be changed rather than show a control that will be refused.
 */
function member(overrides: Partial<AdminMemberDto> = {}): AdminMemberDto {
  return {
    id: 'm-sales',
    userId: 'u-sales',
    name: 'Arun',
    email: 'arun@dealers-drive.in',
    role: 'SALES_REP',
    roleLabel: 'Sales representative',
    status: 'ACTIVE',
    statusLabel: 'Active',
    source: 'INVITED',
    invitedByEmail: 'ops@dealers-drive.in',
    invitedAt: '2026-10-01T08:00:00.000Z',
    activatedAt: '2026-10-01T09:00:00.000Z',
    lastLoginLabel: '2 hours ago',
    disabledAt: null,
    disabledReason: null,
    isYou: false,
    lockedReason: null,
    ...overrides,
  };
}

const COUNTS = { ALL: 3, ACTIVE: 2, INVITED: 0, DISABLED: 1 };

beforeEach(() => {
  vi.mocked(inviteMemberAction).mockClear();
  vi.mocked(changeMemberRoleAction).mockClear();
  vi.mocked(disableMemberAction).mockClear();
  vi.mocked(activateMemberAction).mockClear();
});

describe('AdminMembers', () => {
  it('invites with the chosen role, and says how they sign in', async () => {
    const user = userEvent.setup();
    render(<AdminMembers members={[member()]} counts={COUNTS} status="ALL" />);

    const send = screen.getByRole('button', { name: 'Send invite' });
    expect(send).toBeDisabled();

    await user.type(screen.getByLabelText(/Google email address/), 'new@dealers-drive.in');
    await user.selectOptions(screen.getByLabelText('Role'), 'SALES_REP');
    await user.click(send);

    await waitFor(() => {
      expect(inviteMemberAction).toHaveBeenCalledWith({
        email: 'new@dealers-drive.in',
        name: '',
        role: 'SALES_REP',
      });
    });
    expect(await screen.findByText(/is invited/)).toBeInTheDocument();
  });

  it('locks your own row and an allow-listed row, and says why', () => {
    render(
      <AdminMembers
        members={[
          member({ id: 'me', email: 'me@x.in', isYou: true, lockedReason: 'This is you' }),
          member({
            id: 'boot',
            email: 'boot@x.in',
            source: 'BOOTSTRAP',
            lockedReason: 'Set in ADMIN_ALLOWLIST',
          }),
        ]}
        counts={COUNTS}
        status="ALL"
      />,
    );

    expect(screen.getByText('You')).toBeInTheDocument();
    expect(screen.getByText('Set in ADMIN_ALLOWLIST')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Disable' })).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: /Role for/ })).not.toBeInTheDocument();
  });

  it('changes a role from the row', async () => {
    const user = userEvent.setup();
    render(<AdminMembers members={[member()]} counts={COUNTS} status="ALL" />);

    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Role for arun@dealers-drive.in' }),
      'MODERATOR',
    );

    await waitFor(() => {
      expect(changeMemberRoleAction).toHaveBeenCalledWith('m-sales', 'MODERATOR');
    });
  });

  it('asks for a reason before disabling', async () => {
    const user = userEvent.setup();
    render(<AdminMembers members={[member()]} counts={COUNTS} status="ALL" />);

    await user.click(screen.getByRole('button', { name: 'Disable' }));
    const dialog = await screen.findByRole('dialog');
    const confirm = within(dialog).getByRole('button', { name: 'Disable member' });
    expect(confirm).toBeDisabled();

    await user.type(within(dialog).getByLabelText('Reason'), 'Left the company.');
    await user.click(confirm);

    await waitFor(() => {
      expect(disableMemberAction).toHaveBeenCalledWith('m-sales', 'Left the company.');
    });
  });

  it('offers re-activation, and shows the reason, for a disabled member', async () => {
    const user = userEvent.setup();
    render(
      <AdminMembers
        members={[
          member({
            status: 'DISABLED',
            statusLabel: 'Disabled',
            disabledReason: 'Paused.',
          }),
        ]}
        counts={COUNTS}
        status="DISABLED"
      />,
    );

    expect(screen.getByText('Disabled: Paused.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Re-activate' }));
    await waitFor(() => {
      expect(activateMemberAction).toHaveBeenCalledWith('m-sales');
    });
  });

  it('shows a refusal in the API’s words', async () => {
    vi.mocked(activateMemberAction).mockResolvedValueOnce({
      ok: false,
      message: 'That team member is not disabled.',
    });
    const user = userEvent.setup();
    render(
      <AdminMembers
        members={[member({ status: 'DISABLED', statusLabel: 'Disabled' })]}
        counts={COUNTS}
        status="ALL"
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Re-activate' }));
    expect(await screen.findByText('That team member is not disabled.')).toBeInTheDocument();
  });

  it('marks the current status tab and says when a filter is empty', () => {
    render(<AdminMembers members={[]} counts={COUNTS} status="INVITED" />);

    expect(screen.getByRole('link', { name: /Invited/ })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByText('No team members match this filter.')).toBeInTheDocument();
  });
});
