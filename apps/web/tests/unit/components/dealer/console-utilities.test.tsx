import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ConsoleUtilities } from '@/components/dealer/console-utilities';
import { Dialog } from '@/components/ui/dialog';
import type { CustomerAccount } from '@/features/auth/customer-account';
import { navigationState } from '../../../setup';

const enterWorkspace = vi.fn<(membershipId: string) => Promise<void>>();
const signOut = vi.fn<(scope: 'dealer' | 'admin') => Promise<void>>();
const customerLogout = vi.fn<() => Promise<void>>();
vi.mock('@/features/auth/actions', () => ({
  signOutAction: (scope: 'dealer' | 'admin') => signOut(scope),
}));
vi.mock('@/features/auth/customer-account-actions', () => ({
  enterWorkspaceAction: (membershipId: string) => enterWorkspace(membershipId),
  customerLogoutAction: () => customerLogout(),
}));
const account: CustomerAccount = {
  fullName: 'Ramesh Kumar',
  phoneMasked: '+91 98XXXXXX45',
  invitations: 1,
  workspaces: [
    {
      membershipId: 'first',
      brandName: 'First Motors',
      roleLabel: 'Owner',
      current: true,
      enterable: true,
    },
    {
      membershipId: 'second',
      brandName: 'Second Motors',
      roleLabel: 'Staff',
      current: false,
      enterable: true,
    },
    {
      membershipId: 'closed',
      brandName: 'Closed Motors',
      roleLabel: 'Owner',
      current: false,
      enterable: false,
    },
  ],
};
beforeEach(() => {
  enterWorkspace.mockResolvedValue(undefined);
  signOut.mockResolvedValue(undefined);
  customerLogout.mockResolvedValue(undefined);
});

describe('ConsoleUtilities', () => {
  it('closes its disclosure before a containing Radix navigation dialog', async () => {
    function NavigationDialog() {
      const [open, setOpen] = useState(false);
      return (
        <Dialog
          open={open}
          onOpenChange={setOpen}
          title="Dealer console"
          trigger={<button type="button">Open navigation</button>}
        >
          <ConsoleUtilities account={account} />
        </Dialog>
      );
    }
    const user = userEvent.setup();
    render(<NavigationDialog />);
    const trigger = screen.getByRole('button', { name: 'Open navigation' });
    await user.click(trigger);
    const summary = screen.getByText('Switch dealership');
    await user.click(summary);
    await user.tab();
    expect(screen.getByRole('menuitem', { name: /Dealership invitation/ })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.getByRole('dialog', { name: 'Dealer console' })).toBeInTheDocument();
    expect(summary.closest('details')).not.toHaveAttribute('open');
    expect(summary).toHaveFocus();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
  });
  it('preserves full account logout and its existing home destination', async () => {
    const user = userEvent.setup();
    render(<ConsoleUtilities account={account} />);
    await user.click(screen.getByRole('button', { name: 'Logout' }));
    await waitFor(() => expect(customerLogout).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(navigationState.pushed).toContain('/'));
    expect(signOut).not.toHaveBeenCalled();
  });
  it('supports menu keyboard movement and returns focus when its disclosure closes', async () => {
    const user = userEvent.setup();
    render(<ConsoleUtilities account={account} />);
    const summary = screen.getByText('Switch dealership');
    await user.click(summary);
    await user.tab();
    expect(screen.getByRole('menuitem', { name: /Dealership invitation/ })).toHaveFocus();
    await user.keyboard('{End}');
    expect(screen.getByRole('menuitem', { name: /Second Motors/ })).toHaveFocus();
    await user.keyboard('{Home}');
    expect(screen.getByRole('menuitem', { name: /Dealership invitation/ })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(summary.closest('details')).not.toHaveAttribute('open');
    expect(summary).toHaveFocus();
  });
  it('submits through the existing dealer sign-out action exactly once', async () => {
    const user = userEvent.setup();
    render(<ConsoleUtilities account={null} />);
    await user.click(screen.getByRole('button', { name: 'Sign out' }));
    await waitFor(() => expect(signOut).toHaveBeenCalledWith('dealer'));
    expect(signOut).toHaveBeenCalledTimes(1);
  });
  it('offers sign out without a customer profile avatar or personal account links', () => {
    render(<ConsoleUtilities account={null} />);
    expect(screen.getByRole('button', { name: 'Sign out' })).toHaveAttribute('type', 'submit');
    expect(screen.queryByText('Switch dealership')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Saved cars' })).not.toBeInTheDocument();
  });

  it('preserves current, alternate, suspended and invitation workspace capabilities', async () => {
    const user = userEvent.setup();
    render(<ConsoleUtilities account={account} />);
    await user.click(screen.getByText('Switch dealership'));
    const menu = within(screen.getByRole('menu', { name: 'Your dealerships' }));
    expect(menu.getByRole('menuitem', { name: /First Motors/ })).toHaveAttribute(
      'aria-current',
      'true',
    );
    expect(menu.getByRole('menuitem', { name: /Dealership invitation/ })).toHaveAttribute(
      'href',
      '/invitations',
    );
    expect(menu.getByText('Closed Motors')).toBeInTheDocument();
    expect(menu.queryByRole('menuitem', { name: /Closed Motors/ })).not.toBeInTheDocument();
    await user.click(menu.getByRole('menuitem', { name: /Second Motors/ }));
    await waitFor(() => expect(enterWorkspace).toHaveBeenCalledWith('second'));
    expect(enterWorkspace).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: /Account menu/ })).not.toBeInTheDocument();
  });
});
