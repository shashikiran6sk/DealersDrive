import type { PublicLocations } from '@dealers-drive/contracts';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { navigationState } from '../../../setup';

import { CustomerHeader } from '@/components/layout/customer-header';
import {
  customerAccountAction,
  customerLogoutAction,
} from '@/features/auth/customer-account-actions';
import { HeaderAccount } from '@/features/auth/header-account';

/**
 * The header's account corner (**R67**). The public pages are static, so the
 * header cannot know who is signed in while it renders; it shows Login, then
 * asks once in the browser, and a signed-in customer sees their first name
 * and Logout instead.
 */
vi.mock('@/features/auth/customer-account-actions', () => ({
  customerAccountAction: vi.fn(),
  customerLogoutAction: vi.fn(),
}));

const LOCATIONS: PublicLocations = {
  districts: [],
  total: 0,
  cars: { total: 0, districts: {} },
};

beforeEach(() => {
  vi.mocked(customerAccountAction).mockReset();
  vi.mocked(customerLogoutAction).mockReset();
});

describe('HeaderAccount', () => {
  it('shows Login to somebody not signed in', async () => {
    vi.mocked(customerAccountAction).mockResolvedValue(null);
    render(<HeaderAccount />);

    await waitFor(() => {
      expect(customerAccountAction).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByRole('link', { name: 'Login' })).toHaveAttribute('href', '/login');
    expect(screen.queryByRole('button', { name: 'Logout' })).toBeNull();
  });

  it('greets a signed-in customer by first name, with Logout instead of Login', async () => {
    vi.mocked(customerAccountAction).mockResolvedValue({ fullName: 'Asha Menon' });
    render(<HeaderAccount />);

    expect(await screen.findByText('Hi, Asha')).toBeInTheDocument();
    expect(screen.getByTitle('Signed in as Asha Menon')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Logout' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Login' })).toBeNull();
  });

  it('logs out, shows Login again and refreshes the page', async () => {
    const user = userEvent.setup();
    vi.mocked(customerAccountAction).mockResolvedValue({ fullName: 'Asha Menon' });
    vi.mocked(customerLogoutAction).mockResolvedValue();
    render(<HeaderAccount />);

    await user.click(await screen.findByRole('button', { name: 'Logout' }));

    expect(await screen.findByRole('link', { name: 'Login' })).toBeInTheDocument();
    expect(customerLogoutAction).toHaveBeenCalledTimes(1);
    expect(navigationState.refreshed).toBe(1);
  });

  it('keeps Login if the check fails', async () => {
    vi.mocked(customerAccountAction).mockRejectedValue(new Error('down'));
    render(<HeaderAccount />);

    await waitFor(() => {
      expect(customerAccountAction).toHaveBeenCalled();
    });
    expect(screen.getByRole('link', { name: 'Login' })).toBeInTheDocument();
  });
});

describe('CustomerHeader', () => {
  it('renders the account corner it is given', async () => {
    vi.mocked(customerAccountAction).mockResolvedValue({ fullName: 'Asha Menon' });
    render(<CustomerHeader locations={LOCATIONS} account={<HeaderAccount />} />);

    expect(await screen.findByText('Hi, Asha')).toBeInTheDocument();
  });

  it('falls back to Login when given none', () => {
    render(<CustomerHeader locations={LOCATIONS} />);

    expect(screen.getByRole('link', { name: 'Login' })).toHaveAttribute('href', '/login');
    expect(customerAccountAction).not.toHaveBeenCalled();
  });
});
