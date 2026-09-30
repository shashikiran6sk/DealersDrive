import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { navigationState } from '../../../setup';

import { CustomerLogin, DealerLogin, LoginTabs } from '@/features/auth/login';
import {
  customerPhoneSignInAction,
  customerSignUpAction,
  dealerPhoneSignInAction,
} from '@/features/auth/sign-in-actions';

/**
 * The unified Login (**R63**): one screen, two tabs, Customer first.
 *
 * The Server Actions are stubbed — their own file covers what they send and
 * relay — so these are about the screen: which tab opens, how the keyboard
 * moves between them, and where each flow leads once the phone is proved.
 * The widget is the `fake` driver, so the code is the development code and no
 * script loads.
 */
vi.mock('@/features/auth/sign-in-actions', () => ({
  customerPhoneSignInAction: vi.fn(),
  customerSignUpAction: vi.fn(),
  dealerPhoneSignInAction: vi.fn(),
}));

const WIDGET = {
  enabled: true,
  driver: 'fake',
  widgetId: null,
  tokenAuth: null,
  devCode: '123456',
  reason: null,
} as const;

const GOOGLE = {
  href: 'http://api.test/v1/auth/google/start',
  enabled: true,
  reason: null,
};

const FLOW_TIMEOUT = 15_000;

beforeEach(() => {
  vi.mocked(customerPhoneSignInAction).mockReset();
  vi.mocked(customerSignUpAction).mockReset();
  vi.mocked(dealerPhoneSignInAction).mockReset();
});

async function proveNumber(user: ReturnType<typeof userEvent.setup>, phone = '9840012345') {
  await user.type(screen.getByLabelText(/Mobile number/), phone);
  await user.click(screen.getByRole('button', { name: 'Send OTP' }));
  const first = (await screen.findAllByLabelText(/^Digit /))[0]!;
  await waitFor(() => {
    expect(first).toBeEnabled();
  });
  await user.type(first, '123456');
  await waitFor(() => {
    expect(screen.getByRole('button', { name: 'Verify and sign in' })).toBeEnabled();
  });
  await user.click(screen.getByRole('button', { name: 'Verify and sign in' }));
}

function tabs() {
  return render(
    <LoginTabs initial="customer" customer={<p>customer panel</p>} dealer={<p>dealer panel</p>} />,
  );
}

describe('LoginTabs', () => {
  it('opens on Customer', () => {
    tabs();

    expect(screen.getByRole('tab', { name: 'Customer' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Dealer' })).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByText('customer panel')).toBeVisible();
    expect(screen.getByText('dealer panel')).not.toBeVisible();
  });

  it('switches to Dealer, and back', async () => {
    const user = userEvent.setup();
    tabs();

    await user.click(screen.getByRole('tab', { name: 'Dealer' }));
    expect(screen.getByText('dealer panel')).toBeVisible();
    expect(screen.getByText('customer panel')).not.toBeVisible();

    await user.click(screen.getByRole('tab', { name: 'Customer' }));
    expect(screen.getByText('customer panel')).toBeVisible();
  });

  /** DESIGN-SPEC §2.4: arrow keys move the selection, and focus goes with it. */
  it('moves with the arrow keys, Home and End, keeping one tab in the tab order', async () => {
    const user = userEvent.setup();
    tabs();

    screen.getByRole('tab', { name: 'Customer' }).focus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Dealer' })).toHaveFocus();
    expect(screen.getByRole('tab', { name: 'Dealer' })).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('tab', { name: 'Customer' })).toHaveAttribute('tabindex', '-1');

    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Customer' })).toHaveFocus();

    await user.keyboard('{End}');
    expect(screen.getByRole('tab', { name: 'Dealer' })).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{Home}');
    expect(screen.getByRole('tab', { name: 'Customer' })).toHaveAttribute('aria-selected', 'true');
  });

  it('sits at the start of the form, aligned with what follows, in the order Customer, switch, Dealer', () => {
    tabs();
    const list = screen.getByRole('tablist', { name: 'Sign in as' });
    expect(list).toHaveClass('flex', 'items-center', 'justify-start');
    expect(list).not.toHaveClass('justify-end');
    expect(list.className).not.toMatch(/\b(ml-auto|mx-auto|absolute|translate-x|left-\[)/);

    const order = Array.from(list.querySelectorAll('[role="tab"], [data-slot="switch"]')).map(
      (element) => element.getAttribute('data-slot') ?? element.textContent,
    );
    expect(order).toEqual(['Customer', 'switch', 'Dealer']);
  });

  it('switches with the switch itself, and the switch shows the selected mode', async () => {
    const user = userEvent.setup();
    tabs();
    const toggle = document.querySelector('[data-slot="switch"]');
    if (!(toggle instanceof HTMLElement)) throw new Error('no switch');
    expect(toggle).toHaveAttribute('aria-hidden', 'true');
    expect(toggle).toHaveClass('bg-(--color-neutral-300)');

    await user.click(toggle);
    expect(screen.getByRole('tab', { name: 'Dealer' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Dealer' })).toHaveFocus();
    expect(toggle).toHaveClass('bg-(--color-ink)');
    expect(screen.getByText('dealer panel')).toBeVisible();

    await user.click(toggle);
    expect(screen.getByRole('tab', { name: 'Customer' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('customer panel')).toBeVisible();
  });

  it('opens on Dealer when asked to', () => {
    render(
      <LoginTabs initial="dealer" customer={<p>customer panel</p>} dealer={<p>dealer panel</p>} />,
    );
    expect(screen.getByRole('tab', { name: 'Dealer' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Dealer' })).toHaveAttribute('tabindex', '0');
    expect(screen.getByText('dealer panel')).toBeVisible();
  });

  it('ties each panel to its tab', () => {
    tabs();
    const panel = screen.getByRole('tabpanel');
    expect(panel).toHaveAttribute('aria-labelledby', 'login-tab-customer');
    expect(screen.getByRole('tab', { name: 'Customer' })).toHaveAttribute(
      'aria-controls',
      'login-panel-customer',
    );
  });
});

describe('CustomerLogin', () => {
  it(
    'asks a new customer only for a name, then returns them where they were',
    async () => {
      const user = userEvent.setup();
      vi.mocked(customerPhoneSignInAction).mockResolvedValue({
        status: 'NAME_REQUIRED',
        phoneDisplay: '+91 98400 12345',
      });
      vi.mocked(customerSignUpAction).mockResolvedValue({ done: true });
      render(<CustomerLogin widget={WIDGET} returnTo="/cars/2023-hyundai-creta?enquire=1" />);

      await proveNumber(user);

      expect(customerPhoneSignInAction).toHaveBeenCalledWith(
        '9840012345',
        expect.stringMatching(/^dev-otp:919840012345:123456:/),
      );
      expect(await screen.findByText('Your number is verified')).toBeInTheDocument();
      expect(screen.getByText(/\+91 98400 12345 is confirmed/)).toBeInTheDocument();
      expect(screen.queryByLabelText(/email/i)).toBeNull();
      expect(screen.queryByLabelText(/password/i)).toBeNull();

      await user.type(screen.getByLabelText('Name'), 'Shashikiran');
      await user.click(screen.getByRole('button', { name: 'Create account' }));

      await waitFor(() => {
        expect(navigationState.replaced).toContain('/cars/2023-hyundai-creta?enquire=1');
      });
      expect(customerSignUpAction).toHaveBeenCalledWith('Shashikiran');
    },
    FLOW_TIMEOUT,
  );

  it(
    'signs an existing customer straight in — no name screen',
    async () => {
      const user = userEvent.setup();
      vi.mocked(customerPhoneSignInAction).mockResolvedValue({
        status: 'SIGNED_IN',
        fullName: 'Ravi',
        phoneDisplay: '+91 98400 12345',
      });
      render(<CustomerLogin widget={WIDGET} returnTo="/" />);

      await proveNumber(user);

      await waitFor(() => {
        expect(navigationState.replaced).toContain('/');
      });
      expect(screen.queryByLabelText('Name')).toBeNull();
    },
    FLOW_TIMEOUT,
  );

  it(
    'shows the name error the server gave, and stays',
    async () => {
      const user = userEvent.setup();
      vi.mocked(customerPhoneSignInAction).mockResolvedValue({
        status: 'NAME_REQUIRED',
        phoneDisplay: '+91 98400 12345',
      });
      vi.mocked(customerSignUpAction).mockResolvedValue({ fieldError: 'Enter your name.' });
      render(<CustomerLogin widget={WIDGET} returnTo="/" />);

      await proveNumber(user);
      await user.click(await screen.findByRole('button', { name: 'Create account' }));

      expect(await screen.findByText('Enter your name.')).toBeInTheDocument();
      expect(navigationState.replaced).toEqual([]);
    },
    FLOW_TIMEOUT,
  );

  it(
    'refuses a wrong code with the server’s words, and counts the attempt',
    async () => {
      const user = userEvent.setup();
      vi.mocked(customerPhoneSignInAction).mockResolvedValue({
        error: 'That code could not be verified. Request a new one and try again.',
      });
      render(<CustomerLogin widget={WIDGET} returnTo="/" />);

      await proveNumber(user);

      expect(await screen.findByText(/could not be verified/)).toBeInTheDocument();
      expect(screen.getByText('That code did not match')).toBeInTheDocument();
      expect(navigationState.replaced).toEqual([]);
    },
    FLOW_TIMEOUT,
  );

  it('refuses a landline before sending anything', async () => {
    const user = userEvent.setup();
    render(<CustomerLogin widget={WIDGET} returnTo="/" />);

    await user.type(screen.getByLabelText(/Mobile number/), '0416224889');
    await user.click(screen.getByRole('button', { name: 'Send OTP' }));

    expect(await screen.findByText('Enter a 10-digit Indian mobile number.')).toBeInTheDocument();
    expect(screen.queryByLabelText('6-digit verification code')).toBeNull();
  });

  /** Mobile keyboards: a numeric pad, and the browser's own one-time-code autofill. */
  it('asks for digits on a phone', () => {
    render(<CustomerLogin widget={WIDGET} returnTo="/" />);
    const input = screen.getByLabelText(/Mobile number/);
    expect(input).toHaveAttribute('inputmode', 'numeric');
    expect(input).toHaveAttribute('type', 'tel');
  });

  it('explains itself when phone sign-in is unavailable', () => {
    render(
      <CustomerLogin
        widget={{ ...WIDGET, enabled: false, reason: 'Set MSG91_WIDGET_ID.' }}
        returnTo="/"
      />,
    );
    expect(screen.getByText(/Set MSG91_WIDGET_ID\./)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Send OTP' })).toBeNull();
  });
});

describe('DealerLogin', () => {
  /**
   * The revamp leads with Google and keeps the verified mobile one click away:
   * the same two ways in, the same actions behind them, and the phone form
   * disclosed by a real button that says what it controls.
   */
  it('offers Google first, and the phone behind "Use mobile number instead"', async () => {
    const user = userEvent.setup();
    render(<DealerLogin widget={WIDGET} google={GOOGLE} returnTo={null} error={null} />);

    expect(screen.getByRole('link', { name: /continue with google/i })).toHaveAttribute(
      'href',
      GOOGLE.href,
    );
    expect(screen.getByLabelText(/Mobile number/)).not.toBeVisible();

    const reveal = screen.getByRole('button', { name: 'Use mobile number instead' });
    expect(reveal).toHaveAttribute('aria-expanded', 'false');
    expect(reveal).toHaveAttribute('aria-controls', 'dealer-phone-panel');
    await user.click(reveal);

    expect(screen.getByLabelText(/Mobile number/)).toBeVisible();
    expect(screen.getByLabelText(/Mobile number/)).toHaveFocus();
    expect(screen.queryByRole('button', { name: 'Use mobile number instead' })).toBeNull();
  });

  /** Without Google there is only one way in, so it is not hidden behind a click. */
  it('shows the phone straight away when Google is not configured', () => {
    render(
      <DealerLogin
        widget={WIDGET}
        google={{ ...GOOGLE, enabled: false, reason: 'Set GOOGLE_CLIENT_ID.' }}
        returnTo={null}
        error={null}
      />,
    );

    expect(screen.getByLabelText(/Mobile number/)).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Use mobile number instead' })).toBeNull();
  });

  it(
    'signs a dealer in with the phone and goes where the API said',
    async () => {
      const user = userEvent.setup();
      vi.mocked(dealerPhoneSignInAction).mockResolvedValue({ returnTo: '/dealer/onboarding' });
      render(
        <DealerLogin widget={WIDGET} google={GOOGLE} returnTo="/dealer/inventory" error={null} />,
      );

      await user.click(screen.getByRole('button', { name: 'Use mobile number instead' }));
      await proveNumber(user);

      await waitFor(() => {
        expect(navigationState.replaced).toContain('/dealer/onboarding');
      });
      expect(dealerPhoneSignInAction).toHaveBeenCalledWith(
        '9840012345',
        expect.stringMatching(/^dev-otp:/),
        '/dealer/inventory',
      );
    },
    FLOW_TIMEOUT,
  );

  it('explains a Google refusal it knows, and falls back for one it does not', () => {
    const { rerender } = render(
      <DealerLogin widget={WIDGET} google={GOOGLE} returnTo={null} error="account_suspended" />,
    );
    expect(screen.getByText(/has been suspended/)).toBeInTheDocument();

    rerender(<DealerLogin widget={WIDGET} google={GOOGLE} returnTo={null} error="<b>x</b>" />);
    expect(
      screen.getByText('That sign-in could not be completed. Please try again.'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/<b>/)).toBeNull();
  });
});
