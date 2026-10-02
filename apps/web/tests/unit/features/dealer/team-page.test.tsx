import type { DealerTeamResponse } from '@dealers-drive/contracts';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import TeamPage from '@/app/(dealer)/dealer/team/page';
import { consoleNavFor } from '@/components/dealer/console-nav';
import {
  changeMemberRoleAction,
  inviteMemberAction,
  removeMemberAction,
  revokeInvitationAction,
} from '@/features/dealer/team-actions';
import type * as ApiModule from '@/lib/api';

/**
 * R94 — the owner's Team page. The server page asks the session whether this
 * person may manage the team at all, and a member who may not is sent to the
 * dashboard rather than shown a screen of controls the API would refuse. Every write is
 * a Server Action; these pin what each control sends.
 */
const apiGetParsed = vi.fn();
const currentSession = vi.fn();

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof ApiModule>();
  return { ...actual, apiGetParsed: (...args: unknown[]) => apiGetParsed(...args) as unknown };
});
vi.mock('@/lib/session', () => ({ currentSession: () => currentSession() as unknown }));
vi.mock('@/features/dealer/team-actions', () => ({
  inviteMemberAction: vi.fn(),
  revokeInvitationAction: vi.fn(),
  changeMemberRoleAction: vi.fn(),
  removeMemberAction: vi.fn(),
}));

const TEAM: DealerTeamResponse = {
  members: [
    {
      id: '11111111-1111-4111-8111-111111111111',
      name: 'Shashikiran',
      initials: 'S',
      phoneDisplay: '+91 98400 12345',
      email: 'owner@abc.in',
      role: 'OWNER',
      roleLabel: 'Owner',
      joinedAt: '2026-01-15T10:00:00.000Z',
      joinedLabel: '15 Jan 2026',
      isYou: true,
      manageable: false,
    },
    {
      id: '22222222-2222-4222-8222-222222222222',
      name: 'Arun Kumar',
      initials: 'AK',
      phoneDisplay: '+91 98765 00001',
      email: null,
      role: 'MANAGER',
      roleLabel: 'Manager',
      joinedAt: '2026-10-01T10:00:00.000Z',
      joinedLabel: '1 Oct 2026',
      isYou: false,
      manageable: true,
    },
  ],
  invitations: [
    {
      id: '33333333-3333-4333-8333-333333333333',
      phoneDisplay: '+91 98765 00002',
      role: 'STAFF',
      roleLabel: 'Staff',
      status: 'PENDING',
      statusLabel: 'Waiting for sign-in',
      invitedAt: '2026-10-02T09:30:00.000Z',
      expiresAt: '2026-10-09T09:30:00.000Z',
      expiresLabel: '9 Oct 2026',
    },
  ],
};

const OWNER_SESSION = { permissions: ['member:manage', 'vehicle:read'] };

beforeEach(() => {
  apiGetParsed.mockReset().mockResolvedValue(TEAM);
  currentSession.mockReset().mockResolvedValue(OWNER_SESSION);
  vi.mocked(inviteMemberAction).mockReset().mockResolvedValue({ ok: true });
  vi.mocked(revokeInvitationAction).mockReset().mockResolvedValue({ ok: true });
  vi.mocked(changeMemberRoleAction).mockReset().mockResolvedValue({ ok: true });
  vi.mocked(removeMemberAction).mockReset().mockResolvedValue({ ok: true });
});

describe('who sees the Team page', () => {
  it('sends a member who may not manage the team to the dashboard, and asks for nothing', async () => {
    currentSession.mockResolvedValue({ permissions: ['vehicle:read', 'enquiry:read'] });
    await expect(TeamPage()).rejects.toThrow('NEXT_REDIRECT:/dealer');
    expect(apiGetParsed).not.toHaveBeenCalled();
  });

  it('puts Team in the console nav for an owner only', () => {
    expect(consoleNavFor(['member:manage']).map((item) => item.label)).toContain('Team');
    expect(consoleNavFor(['vehicle:read']).map((item) => item.label)).not.toContain('Team');
  });
});

describe('the Team page', () => {
  it('lists the owner without controls and each member with a role and Remove', async () => {
    render(await TeamPage());

    const members = screen.getByRole('list', { name: 'Team members' });
    const [owner, arun] = within(members).getAllByRole('listitem');
    expect(owner).toHaveTextContent('Shashikiran');
    expect(owner).toHaveTextContent('You');
    expect(within(owner!).queryByRole('combobox')).toBeNull();
    expect(within(owner!).queryByRole('button', { name: 'Remove' })).toBeNull();

    expect(within(arun!).getByRole('combobox', { name: 'Role for Arun Kumar' })).toHaveValue(
      'MANAGER',
    );
    expect(within(arun!).getByRole('button', { name: 'Remove' })).toBeInTheDocument();
  });

  it('lists the invitations waiting, each with Withdraw', async () => {
    const user = userEvent.setup();
    render(await TeamPage());

    const waiting = screen.getByRole('list', { name: 'Invitations waiting for sign-in' });
    expect(waiting).toHaveTextContent('+91 98765 00002');
    expect(waiting).toHaveTextContent('Staff');
    await user.click(
      within(waiting).getByRole('button', {
        name: 'Withdraw the invitation to +91 98765 00002',
      }),
    );
    expect(revokeInvitationAction).toHaveBeenCalledWith('33333333-3333-4333-8333-333333333333');
  });

  it('changes a member’s role', async () => {
    const user = userEvent.setup();
    render(await TeamPage());
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Role for Arun Kumar' }),
      'STAFF',
    );
    expect(changeMemberRoleAction).toHaveBeenCalledWith(
      '22222222-2222-4222-8222-222222222222',
      'STAFF',
    );
  });

  it('asks before removing, then removes', async () => {
    const user = userEvent.setup();
    render(await TeamPage());
    await user.click(screen.getByRole('button', { name: 'Remove' }));

    const dialog = await screen.findByRole('dialog', { name: 'Remove Arun Kumar?' });
    expect(removeMemberAction).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole('button', { name: 'Remove from team' }));

    expect(removeMemberAction).toHaveBeenCalledWith('22222222-2222-4222-8222-222222222222');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('keeps the removal dialog open with the reason when the API refuses', async () => {
    vi.mocked(removeMemberAction).mockResolvedValue({ ok: false, message: 'Not allowed.' });
    const user = userEvent.setup();
    render(await TeamPage());
    await user.click(screen.getByRole('button', { name: 'Remove' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Remove from team' }));

    expect(await within(dialog).findByText('Not allowed.')).toBeInTheDocument();
  });
});

describe('inviting a member', () => {
  async function openInvite() {
    const user = userEvent.setup();
    render(await TeamPage());
    await user.click(screen.getByRole('button', { name: 'Invite member' }));
    const dialog = await screen.findByRole('dialog', { name: 'Invite a member' });
    return { user, dialog };
  }

  it('offers Manager and Staff, never Owner, with Staff chosen', async () => {
    const { dialog } = await openInvite();
    const radios = within(dialog).getAllByRole('radio');
    expect(radios.map((radio) => (radio as HTMLInputElement).value)).toEqual(['MANAGER', 'STAFF']);
    expect(within(dialog).getByRole('radio', { name: /Staff/ })).toBeChecked();
  });

  it('sends the number and the role chosen, and closes', async () => {
    const { user, dialog } = await openInvite();
    const invite = within(dialog).getByRole('button', { name: 'Invite' });
    expect(invite).toBeDisabled();

    await user.type(within(dialog).getByLabelText(/Mobile number/), '98765 00003');
    await user.click(within(dialog).getByRole('radio', { name: /Manager/ }));
    await user.click(invite);

    expect(inviteMemberAction).toHaveBeenCalledWith('98765 00003', 'MANAGER');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByText('Invitation saved for 98765 00003.')).toBeInTheDocument();
  });

  it('keeps the dialog open with the API’s reason when the invitation is refused', async () => {
    vi.mocked(inviteMemberAction).mockResolvedValue({
      ok: false,
      message: 'That number already belongs to a member of this dealership.',
    });
    const { user, dialog } = await openInvite();
    await user.type(within(dialog).getByLabelText(/Mobile number/), '9876500001');
    await user.click(within(dialog).getByRole('button', { name: 'Invite' }));

    expect(
      await within(dialog).findByText(
        'That number already belongs to a member of this dealership.',
      ),
    ).toBeInTheDocument();
  });
});
