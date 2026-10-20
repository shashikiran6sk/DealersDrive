import type { PublicLocations } from '@dealers-drive/contracts';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { navigationState } from '../../../setup';

import { CustomerHeader } from '@/components/layout/customer-header';
import {
  customerLogoutAction,
  enterWorkspaceAction,
} from '@/features/auth/customer-account-actions';
import { HeaderAccount } from '@/features/auth/header-account';
import { fetchCustomerAccount } from '@/features/auth/header-account/account-client';
import { maskIndianMobile, personInitials } from '@/lib/person';

/**
 * The header's account corner (**R67**, as **R76** makes it a menu). The
 * public pages are static, so the header cannot know who is signed in while
 * it renders. A readable `dd_auth` hint decides what is drawn before the answer
 * arrives: Login when it says signed out, an avatar-sized placeholder when it
 * says signed in or nothing — never Login for somebody who may be signed in.
 * The answer itself comes from one `GET /api/account` in the browser. A signed-in
 * customer sees a round avatar with their initials, which opens a menu:
 * their name and masked number, Saved cars, My enquiries, Dealer Login, Logout.
 * Dealer Login is only a link to the Dealer tab of `/login` (**R93**) for a
 * customer who belongs to no dealership; a member sees their dealerships
 * instead, and enters one with the session they already have.
 */
vi.mock('@/features/auth/customer-account-actions', () => ({
  customerLogoutAction: vi.fn(),
  enterWorkspaceAction: vi.fn(),
}));
vi.mock('@/features/auth/header-account/account-client', () => ({
  fetchCustomerAccount: vi.fn(),
}));

function setHint(value: '0' | '1' | null) {
  document.cookie = value === null ? 'dd_auth=; Path=/; Max-Age=0' : `dd_auth=${value}; Path=/`;
}

const LOCATIONS: PublicLocations = {
  districts: [],
  total: 0,
  cars: { total: 0, districts: {} },
};

const ASHA = { fullName: 'Asha Menon', phoneMasked: '+91 98XXXXXX12' };

beforeEach(() => {
  setHint(null);
  vi.mocked(fetchCustomerAccount).mockReset();
  vi.mocked(customerLogoutAction).mockReset();
});

async function openMenu() {
  const user = userEvent.setup();
  vi.mocked(fetchCustomerAccount).mockResolvedValue(ASHA);
  render(<HeaderAccount />);
  const trigger = await screen.findByRole('button', { name: 'Account menu for Asha Menon' });
  await user.click(trigger);
  const menu = await screen.findByRole('menu', { name: 'Account' });
  return { user, trigger, menu };
}

describe('HeaderAccount', () => {
  it('shows Login to somebody not signed in, and no avatar', async () => {
    vi.mocked(fetchCustomerAccount).mockResolvedValue(null);
    render(<HeaderAccount />);

    await waitFor(() => {
      expect(fetchCustomerAccount).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByRole('link', { name: 'Login' })).toHaveAttribute('href', '/login');
    expect(screen.queryByRole('button', { name: /Account menu/ })).toBeNull();
  });

  it('shows a signed-in customer a round avatar with their initials, closed', async () => {
    vi.mocked(fetchCustomerAccount).mockResolvedValue(ASHA);
    render(<HeaderAccount />);

    const trigger = await screen.findByRole('button', { name: 'Account menu for Asha Menon' });
    expect(trigger).toHaveTextContent('AM');
    expect(trigger).toHaveClass('rounded-full');
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('menu')).toBeNull();
    expect(screen.queryByRole('link', { name: 'Login' })).toBeNull();
  });

  it('opens a menu with the name, the masked number, Saved cars, My enquiries, Support requests, Dealer Login and Logout', async () => {
    const { trigger, menu } = await openMenu();

    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Asha Menon')).toBeInTheDocument();
    expect(screen.getByText('+91 98XXXXXX12')).toBeInTheDocument();
    const items = within(menu).getAllByRole('menuitem');
    expect(items.map((item) => item.textContent)).toEqual([
      'Saved cars',
      'My enquiries',
      'Support requests',
      'Dealer Login',
      'Logout',
    ]);
    expect(within(menu).getByRole('menuitem', { name: 'Saved cars' })).toHaveAttribute(
      'href',
      '/saved',
    );
    expect(within(menu).getByRole('menuitem', { name: 'My enquiries' })).toHaveAttribute(
      'href',
      '/enquiries',
    );
    expect(within(menu).getByRole('menuitem', { name: 'Support requests' })).toHaveAttribute(
      'href',
      '/support-requests',
    );
  });

  it('puts focus on the first item, moves with the arrow keys, Home and End, and wraps', async () => {
    const { user, menu } = await openMenu();
    const [saved, enquiries, support, dealer, logout] = within(menu).getAllByRole('menuitem');

    await waitFor(() => expect(saved).toHaveFocus());
    await user.keyboard('{ArrowDown}');
    expect(enquiries).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(support).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(dealer).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(logout).toHaveFocus();
    await user.keyboard('{ArrowUp}');
    expect(dealer).toHaveFocus();
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

  it('offers Dealer Login as a link to the Dealer tab, set apart between separators', async () => {
    const { menu } = await openMenu();
    const dealer = within(menu).getByRole('menuitem', { name: 'Dealer Login' });

    expect(dealer.tagName).toBe('A');
    expect(dealer).toHaveAttribute('href', '/login?as=dealer');
    expect(dealer.className).toBe(
      within(menu).getByRole('menuitem', { name: 'Saved cars' }).className,
    );
    const previous = dealer.previousElementSibling;
    const next = dealer.nextElementSibling;
    expect(previous).toHaveAttribute('role', 'separator');
    expect(next).toHaveAttribute('role', 'separator');
  });

  it('closes when Dealer Login is chosen, and does no sign-in work of its own', async () => {
    const { user, menu } = await openMenu();
    await user.click(within(menu).getByRole('menuitem', { name: 'Dealer Login' }));

    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
    expect(customerLogoutAction).not.toHaveBeenCalled();
    expect(navigationState.refreshed).toBe(0);
    expect(screen.getByRole('button', { name: 'Account menu for Asha Menon' })).toBeInTheDocument();
  });

  it('reaches Dealer Login from the keyboard and opens it with Enter', async () => {
    const { user, menu } = await openMenu();
    const dealer = within(menu).getByRole('menuitem', { name: 'Dealer Login' });
    await waitFor(() =>
      expect(within(menu).getByRole('menuitem', { name: 'Saved cars' })).toHaveFocus(),
    );
    await user.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}');
    expect(dealer).toHaveFocus();
    await user.keyboard('{Enter}');
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

  it('never draws a visible Login before it knows: both are rendered, the hint picks one', () => {
    vi.mocked(fetchCustomerAccount).mockReturnValue(new Promise(() => undefined));
    const { container } = render(<HeaderAccount />);

    expect(screen.getByRole('link', { name: 'Login' })).toHaveClass('auth-out-only');
    expect(container.querySelector('[data-auth-placeholder]')).toHaveClass('auth-in-only');
    expect(screen.queryByRole('button', { name: /Account menu/ })).toBeNull();
  });

  it('shows Login at once, and asks nothing, when the hint says signed out', () => {
    setHint('0');
    const { container } = render(<HeaderAccount />);

    expect(screen.getByRole('link', { name: 'Login' })).not.toHaveClass('auth-out-only');
    expect(container.querySelector('[data-auth-placeholder]')).toBeNull();
    expect(fetchCustomerAccount).not.toHaveBeenCalled();
  });

  it('holds an avatar-sized placeholder, not Login, while a signed-in account loads', async () => {
    setHint('1');
    let answer: (value: typeof ASHA) => void = () => undefined;
    vi.mocked(fetchCustomerAccount).mockReturnValue(
      new Promise((resolve) => {
        answer = resolve;
      }),
    );
    const { container } = render(<HeaderAccount />);

    const placeholder = container.querySelector('[data-auth-placeholder]');
    expect(placeholder).toHaveClass('h-[40px]', 'w-[40px]', 'rounded-full');
    expect(screen.queryByRole('link', { name: 'Login' })).toBeNull();

    answer(ASHA);
    expect(
      await screen.findByRole('button', { name: 'Account menu for Asha Menon' }),
    ).toBeInTheDocument();
    expect(container.querySelector('[data-auth-placeholder]')).toBeNull();
    expect(fetchCustomerAccount).toHaveBeenCalledTimes(1);
  });

  it('keeps Login if the check fails', async () => {
    vi.mocked(fetchCustomerAccount).mockRejectedValue(new Error('down'));
    render(<HeaderAccount />);

    await waitFor(() => {
      expect(fetchCustomerAccount).toHaveBeenCalled();
    });
    expect(screen.getByRole('link', { name: 'Login' })).toBeInTheDocument();
  });
});

describe('a member’s dealerships (R93)', () => {
  const ARUN = {
    fullName: 'Arun Kumar',
    phoneMasked: '+91 98XXXXXX45',
    workspaces: [
      {
        membershipId: 'm-abc',
        brandName: 'ABC Motors',
        roleLabel: 'Manager',
        enterable: true,
        current: true,
      },
      {
        membershipId: 'm-xyz',
        brandName: 'XYZ Cars',
        roleLabel: 'Staff',
        enterable: true,
        current: false,
      },
      {
        membershipId: 'm-old',
        brandName: 'Old Yard',
        roleLabel: 'Staff',
        enterable: false,
        current: false,
      },
    ],
  };

  async function openArun() {
    const user = userEvent.setup();
    vi.mocked(fetchCustomerAccount).mockResolvedValue(ARUN);
    render(<HeaderAccount />);
    await user.click(await screen.findByRole('button', { name: 'Account menu for Arun Kumar' }));
    return { user, menu: await screen.findByRole('menu', { name: 'Account' }) };
  }

  it('lists each enterable dealership with the role, instead of Dealer Login', async () => {
    const { menu } = await openArun();
    const names = within(menu)
      .getAllByRole('menuitem')
      .map((item) => item.textContent);
    expect(names).toEqual([
      'Saved cars',
      'My enquiries',
      'Support requests',
      'ABC MotorsCurrentDealer dashboard · Manager',
      'XYZ CarsDealer dashboard · Staff',
      'Logout',
    ]);
    expect(within(menu).queryByRole('menuitem', { name: 'Dealer Login' })).toBeNull();
    expect(within(menu).getByRole('menuitem', { name: /ABC Motors/ })).toHaveAttribute(
      'aria-current',
      'true',
    );
  });

  it('shows a suspended dealership as closed, not as something to press', async () => {
    const { menu } = await openArun();
    expect(within(menu).getByText('Old Yard')).toBeInTheDocument();
    expect(within(menu).getByText('Suspended — dealer access is closed')).toBeInTheDocument();
    expect(within(menu).queryByRole('menuitem', { name: /Old Yard/ })).toBeNull();
  });

  it('enters a dealership through the session it already has — no sign-in, no logout', async () => {
    vi.mocked(enterWorkspaceAction).mockResolvedValue();
    const { user, menu } = await openArun();
    await user.click(within(menu).getByRole('menuitem', { name: /XYZ Cars/ }));

    expect(enterWorkspaceAction).toHaveBeenCalledWith('m-xyz');
    expect(customerLogoutAction).not.toHaveBeenCalled();
  });

  it('uses an account it is given without asking for one, and goes home after logout', async () => {
    vi.mocked(customerLogoutAction).mockResolvedValue();
    const user = userEvent.setup();
    render(<HeaderAccount initialAccount={ARUN} afterLogoutHref="/" />);
    await user.click(screen.getByRole('button', { name: 'Account menu for Arun Kumar' }));
    await user.click(
      within(await screen.findByRole('menu')).getByRole('menuitem', { name: 'Logout' }),
    );

    expect(fetchCustomerAccount).not.toHaveBeenCalled();
    await waitFor(() => expect(navigationState.pushed).toContain('/'));
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
    vi.mocked(fetchCustomerAccount).mockResolvedValue(ASHA);
    render(<CustomerHeader locations={LOCATIONS} account={<HeaderAccount />} />);

    expect(
      await screen.findByRole('button', { name: 'Account menu for Asha Menon' }),
    ).toBeInTheDocument();
  });

  it('falls back to Login when given none', () => {
    render(<CustomerHeader locations={LOCATIONS} />);

    expect(screen.getByRole('link', { name: 'Login' })).toHaveAttribute('href', '/login');
    expect(fetchCustomerAccount).not.toHaveBeenCalled();
  });
});
