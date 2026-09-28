import type { PublicLocations } from '@dealers-drive/contracts';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { navigationState } from '../../../setup';

import { CustomerHeader } from '@/components/layout/customer-header';
import {
  customerAccountAction,
  customerLogoutAction,
} from '@/features/auth/customer-account-actions';
import { HeaderAccount } from '@/features/auth/header-account';
import { maskIndianMobile, personInitials } from '@/lib/person';

/**
 * The header's account corner (**R67**, as **R76** makes it a menu). The
 * public pages are static, so the header cannot know who is signed in while
 * it renders; it shows Login, then asks once in the browser. A signed-in
 * customer sees a round avatar with their initials, which opens a menu:
 * their name and masked number, Saved cars, My enquiries, Logout.
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

const ASHA = { fullName: 'Asha Menon', phoneMasked: '+91 98XXXXXX12' };

beforeEach(() => {
  vi.mocked(customerAccountAction).mockReset();
  vi.mocked(customerLogoutAction).mockReset();
});

async function openMenu() {
  const user = userEvent.setup();
  vi.mocked(customerAccountAction).mockResolvedValue(ASHA);
  render(<HeaderAccount />);
  const trigger = await screen.findByRole('button', { name: 'Account menu for Asha Menon' });
  await user.click(trigger);
  const menu = await screen.findByRole('menu', { name: 'Account' });
  return { user, trigger, menu };
}

describe('HeaderAccount', () => {
  it('shows Login to somebody not signed in, and no avatar', async () => {
    vi.mocked(customerAccountAction).mockResolvedValue(null);
    render(<HeaderAccount />);

    await waitFor(() => {
      expect(customerAccountAction).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByRole('link', { name: 'Login' })).toHaveAttribute('href', '/login');
    expect(screen.queryByRole('button', { name: /Account menu/ })).toBeNull();
  });

  it('shows a signed-in customer a round avatar with their initials, closed', async () => {
    vi.mocked(customerAccountAction).mockResolvedValue(ASHA);
    render(<HeaderAccount />);

    const trigger = await screen.findByRole('button', { name: 'Account menu for Asha Menon' });
    expect(trigger).toHaveTextContent('AM');
    expect(trigger).toHaveClass('rounded-full');
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('menu')).toBeNull();
    expect(screen.queryByRole('link', { name: 'Login' })).toBeNull();
  });

  it('opens a menu with the name, the masked number, Saved cars, My enquiries and Logout', async () => {
    const { trigger, menu } = await openMenu();

    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Asha Menon')).toBeInTheDocument();
    expect(screen.getByText('+91 98XXXXXX12')).toBeInTheDocument();
    const items = within(menu).getAllByRole('menuitem');
    expect(items.map((item) => item.textContent)).toEqual(['Saved cars', 'My enquiries', 'Logout']);
    expect(within(menu).getByRole('menuitem', { name: 'Saved cars' })).toHaveAttribute(
      'href',
      '/saved',
    );
    expect(within(menu).getByRole('menuitem', { name: 'My enquiries' })).toHaveAttribute(
      'href',
      '/enquiries',
    );
  });

  it('puts focus on the first item, moves with the arrow keys, Home and End, and wraps', async () => {
    const { user, menu } = await openMenu();
    const [saved, enquiries, logout] = within(menu).getAllByRole('menuitem');

    await waitFor(() => expect(saved).toHaveFocus());
    await user.keyboard('{ArrowDown}');
    expect(enquiries).toHaveFocus();
    await user.keyboard('{End}');
    expect(logout).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(saved).toHaveFocus();
    await user.keyboard('{ArrowUp}');
    expect(logout).toHaveFocus();
    await user.keyboard('{Home}');
    expect(saved).toHaveFocus();
  });

  it('closes on Escape and gives focus back to the avatar', async () => {
    const { user, trigger } = await openMenu();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
    expect(trigger).toHaveFocus();
  });

  it('closes on a click outside', async () => {
    const { user } = await openMenu();
    await user.click(document.body);
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
  });

  it('closes when a destination is chosen', async () => {
    const { user, menu } = await openMenu();
    await user.click(within(menu).getByRole('menuitem', { name: 'Saved cars' }));
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
  });

  it('logs out, shows Login again and refreshes the page', async () => {
    vi.mocked(customerLogoutAction).mockResolvedValue();
    const { user, menu } = await openMenu();

    await user.click(within(menu).getByRole('menuitem', { name: 'Logout' }));

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

describe('personInitials', () => {
  it.each([
    ['Shashikiran', 'S'],
    ['Shashikiran Kumar', 'SK'],
    ['Rahul', 'R'],
    ['John Doe', 'JD'],
    ['Asha  Mary  Menon', 'AM'],
    ['  priya  ', 'P'],
    ['Élodie Durand', 'ÉD'],
    ['', '?'],
  ])('writes %j as %j — at most two letters, first and last name', (name, expected) => {
    expect(personInitials(name)).toBe(expected);
  });
});

describe('maskIndianMobile', () => {
  it('shows the first two and the last two digits of the number, and nothing between', () => {
    expect(maskIndianMobile('+919812345612')).toBe('+91 98XXXXXX12');
    expect(maskIndianMobile('9812345612')).toBe('+91 98XXXXXX12');
  });

  it('leaves anything that is not an Indian mobile as it is', () => {
    expect(maskIndianMobile('12345')).toBe('12345');
  });
});

describe('CustomerHeader', () => {
  it('renders the account corner it is given', async () => {
    vi.mocked(customerAccountAction).mockResolvedValue(ASHA);
    render(<CustomerHeader locations={LOCATIONS} account={<HeaderAccount />} />);

    expect(
      await screen.findByRole('button', { name: 'Account menu for Asha Menon' }),
    ).toBeInTheDocument();
  });

  it('falls back to Login when given none', () => {
    render(<CustomerHeader locations={LOCATIONS} />);

    expect(screen.getByRole('link', { name: 'Login' })).toHaveAttribute('href', '/login');
    expect(customerAccountAction).not.toHaveBeenCalled();
  });
});
