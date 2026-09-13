import type { AdminAccessEntry } from '@dealers-drive/contracts';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AdminAccessPanel } from '@/features/admin/admin-access';

/**
 * R42 — the panel that hands out a cross-tenant seat.
 *
 * What is asserted here is what the panel has to get right for the two refusals
 * to mean anything. Both are enforced on the server; the panel's job is to not
 * offer a control it knows will be refused, because a Withdraw button that
 * returns an error is how an operator concludes the product is broken.
 *
 *   · **your own row** — withdrawing it could leave nobody able to let you in;
 *   · **an allow-listed address** — the environment admits them, so the answer
 *     is in the deployment and the row says so.
 */
const grantAdminAccessAction = vi.fn();
const revokeAdminAccessAction = vi.fn();

vi.mock('@/features/admin/access-actions', () => ({
  grantAdminAccessAction: (input: unknown) => grantAdminAccessAction(input) as unknown,
  revokeAdminAccessAction: (userId: string) => revokeAdminAccessAction(userId) as unknown,
}));

const CURRENT = '2f1c4a8e-1111-4000-8000-000000000001';

function entry(overrides: Partial<AdminAccessEntry> = {}): AdminAccessEntry {
  return {
    userId: '7a2b3c4d-2222-4000-8000-000000000002',
    email: 'ops.two@dealers-drive.in',
    fullName: 'Second Operator',
    adminRole: 'MODERATOR',
    source: 'GRANT',
    sourceLabel: 'Granted',
    grantedByEmail: 'ops@dealers-drive.in',
    grantedAt: '2026-09-10T08:00:00.000Z',
    lastLoginLabel: '2 days ago',
    canRevoke: true,
    revokeBlockedReason: null,
    ...overrides,
  };
}

const ALLOWLISTED = entry({
  userId: CURRENT,
  email: 'ops@dealers-drive.in',
  adminRole: 'SUPER_ADMIN',
  source: 'ALLOWLIST',
  sourceLabel: 'Allow-listed',
  grantedByEmail: null,
  canRevoke: false,
  revokeBlockedReason: 'Set in ADMIN_ALLOWLIST',
});

beforeEach(() => {
  grantAdminAccessAction.mockReset();
  revokeAdminAccessAction.mockReset();
  grantAdminAccessAction.mockResolvedValue({ ok: true, entry: entry() });
  revokeAdminAccessAction.mockResolvedValue({ ok: true });
});

describe('the list', () => {
  it('offers Withdraw for a granted seat', () => {
    render(<AdminAccessPanel entries={[entry()]} currentUserId={CURRENT} />);

    expect(screen.getByRole('button', { name: 'Withdraw' })).toBeInTheDocument();
    expect(screen.getByText('by ops@dealers-drive.in')).toBeInTheDocument();
  });

  it('says where an allow-listed address comes from, and offers no control', () => {
    render(
      <AdminAccessPanel
        entries={[entry({ ...ALLOWLISTED, userId: 'someone-else' })]}
        currentUserId={CURRENT}
      />,
    );

    expect(screen.getByText('Set in ADMIN_ALLOWLIST')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Withdraw' })).not.toBeInTheDocument();
  });

  /** There may be nobody left who can let you back in. */
  it('marks your own row rather than offering to withdraw it', () => {
    render(<AdminAccessPanel entries={[ALLOWLISTED]} currentUserId={CURRENT} />);

    expect(screen.getByText('You')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Withdraw' })).not.toBeInTheDocument();
  });

  /** An allow-listed address nobody has signed in with has no account row. */
  it('lists an address with no account yet', () => {
    render(
      <AdminAccessPanel
        entries={[
          entry({
            ...ALLOWLISTED,
            userId: null,
            email: 'standby@dealers-drive.in',
            lastLoginLabel: 'Never',
          }),
        ]}
        currentUserId={CURRENT}
      />,
    );

    expect(screen.getByText('standby@dealers-drive.in')).toBeInTheDocument();
    expect(screen.getByText('Never')).toBeInTheDocument();
  });
});

describe('granting', () => {
  it('sends the address and the chosen role', async () => {
    const user = userEvent.setup();
    render(<AdminAccessPanel entries={[ALLOWLISTED]} currentUserId={CURRENT} />);

    await user.type(screen.getByLabelText(/Email address/), 'new@dealers-drive.in');
    await user.selectOptions(screen.getByLabelText('Role'), 'SUPPORT');
    await user.click(screen.getByRole('button', { name: 'Grant access' }));

    expect(grantAdminAccessAction).toHaveBeenCalledWith({
      email: 'new@dealers-drive.in',
      adminRole: 'SUPPORT',
    });
  });

  /** Moderator, not super admin: the narrowest useful seat is the safe default. */
  it('defaults to the moderator seat', async () => {
    const user = userEvent.setup();
    render(<AdminAccessPanel entries={[ALLOWLISTED]} currentUserId={CURRENT} />);

    await user.type(screen.getByLabelText(/Email address/), 'new@dealers-drive.in');
    await user.click(screen.getByRole('button', { name: 'Grant access' }));

    expect(grantAdminAccessAction).toHaveBeenCalledWith(
      expect.objectContaining({ adminRole: 'MODERATOR' }),
    );
  });

  it('will not submit an empty address', () => {
    render(<AdminAccessPanel entries={[ALLOWLISTED]} currentUserId={CURRENT} />);

    expect(screen.getByRole('button', { name: 'Grant access' })).toBeDisabled();
  });

  it('shows the server’s refusal', async () => {
    grantAdminAccessAction.mockResolvedValue({
      ok: false,
      message: 'That address is on ADMIN_ALLOWLIST.',
    });
    const user = userEvent.setup();
    render(<AdminAccessPanel entries={[ALLOWLISTED]} currentUserId={CURRENT} />);

    await user.type(screen.getByLabelText(/Email address/), 'ops@dealers-drive.in');
    await user.click(screen.getByRole('button', { name: 'Grant access' }));

    expect(await screen.findByText('That address is on ADMIN_ALLOWLIST.')).toBeInTheDocument();
  });

  it('says who was let in, and clears the box', async () => {
    const user = userEvent.setup();
    render(<AdminAccessPanel entries={[ALLOWLISTED]} currentUserId={CURRENT} />);

    const box = screen.getByLabelText(/Email address/);
    await user.type(box, 'new@dealers-drive.in');
    await user.click(screen.getByRole('button', { name: 'Grant access' }));

    expect(await screen.findByText(/can now open the admin console/)).toBeInTheDocument();
    expect(box).toHaveValue('');
  });
});

describe('withdrawing', () => {
  it('withdraws by account id', async () => {
    const user = userEvent.setup();
    render(<AdminAccessPanel entries={[entry()]} currentUserId={CURRENT} />);

    await user.click(screen.getByRole('button', { name: 'Withdraw' }));

    expect(revokeAdminAccessAction).toHaveBeenCalledWith('7a2b3c4d-2222-4000-8000-000000000002');
  });
});
