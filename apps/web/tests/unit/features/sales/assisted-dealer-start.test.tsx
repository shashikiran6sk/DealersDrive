import type { PhoneOtpWidget } from '@dealers-drive/contracts';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AssistedDealerStart } from '@/features/sales/assisted-dealer-start';
import {
  createAssistedDealerAction,
  verifyDealerPhoneAction,
} from '@/features/sales/sales-actions';

import { navigationState } from '../../../setup';

vi.mock('@/features/sales/sales-actions', () => ({
  verifyDealerPhoneAction: vi.fn(),
  createAssistedDealerAction: vi.fn(),
}));

const FAKE: PhoneOtpWidget = {
  enabled: true,
  driver: 'fake',
  widgetId: null,
  tokenAuth: null,
  devCode: '123456',
  reason: null,
};

/**
 * R112 — the first two minutes of an assisted onboarding: the dealer's
 * consent, the code on their handset, and only then the details form.
 */
beforeEach(() => {
  vi.mocked(verifyDealerPhoneAction).mockReset();
  vi.mocked(createAssistedDealerAction).mockReset();
  navigationState.pushed.length = 0;
});

async function enterCode(user: ReturnType<typeof userEvent.setup>) {
  const digits = await screen.findAllByLabelText(/^Digit /);
  for (const [index, digit] of digits.entries()) await user.type(digit, String(index + 1));
}

describe('AssistedDealerStart', () => {
  it('shows a duplicate email error and preserves entered details through renewed mobile verification', async () => {
    vi.mocked(verifyDealerPhoneAction).mockResolvedValue({
      verified: true,
      phone: '+919840012345',
      phoneTicket: 'ticket-new',
    });
    vi.mocked(createAssistedDealerAction).mockResolvedValue({
      ok: false,
      message: 'This email address is already associated with a dealer account.',
      fieldErrors: { email: 'Use another email or contact support.' },
    });
    const user = userEvent.setup();
    render(<AssistedDealerStart widget={FAKE} />);
    await user.type(
      screen.getByLabelText('Dealer’s mobile number', { exact: false, selector: 'input' }),
      '9840012345',
    );
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Send OTP' }));
    await enterCode(user);
    await user.click(screen.getByRole('button', { name: /Verify/ }));
    await screen.findByText('Dealer’s mobile verified');
    await user.click(screen.getByRole('button', { name: 'Continue to dealership details' }));
    await user.type(screen.getByLabelText(/Contact person/), 'Synthetic Representative');
    await user.type(screen.getByLabelText(/Dealer’s email/), 'conflict@example.test');
    await user.click(screen.getByRole('button', { name: 'Create dealership' }));
    expect(await screen.findByText(/already associated/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Dealer’s email/)).toHaveAttribute('aria-invalid', 'true');
    await user.click(screen.getByRole('button', { name: 'Verify mobile again' }));
    await user.click(screen.getByRole('button', { name: 'Send OTP' }));
    await enterCode(user);
    await user.click(screen.getByRole('button', { name: /Verify/ }));
    await screen.findByText('Dealer’s mobile verified');
    await user.click(screen.getByRole('button', { name: 'Continue to dealership details' }));
    expect(screen.getByLabelText(/Contact person/)).toHaveValue('Synthetic Representative');
    expect(screen.getByLabelText(/Dealer’s email/)).toHaveValue('conflict@example.test');
  });
  it('will not send a code until the dealer has consented', async () => {
    const user = userEvent.setup();
    render(<AssistedDealerStart widget={FAKE} />);

    await user.type(
      screen.getByLabelText('Dealer’s mobile number', { exact: false, selector: 'input' }),
      '9840012345',
    );
    await user.click(screen.getByRole('button', { name: 'Send OTP' }));

    expect(await screen.findByText(/tick the box/)).toBeInTheDocument();
    expect(screen.queryAllByLabelText(/^Digit /)).toHaveLength(0);
  });

  it('refuses a number that is not an Indian mobile', async () => {
    const user = userEvent.setup();
    render(<AssistedDealerStart widget={FAKE} />);

    await user.type(
      screen.getByLabelText('Dealer’s mobile number', { exact: false, selector: 'input' }),
      '12345',
    );
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Send OTP' }));

    expect(await screen.findByText(/10-digit Indian mobile/)).toBeInTheDocument();
  });

  it('verifies with consent, then creates the dealership with the ticket', async () => {
    vi.mocked(verifyDealerPhoneAction).mockResolvedValue({
      verified: true,
      phone: '+919840012345',
      phoneTicket: 'ticket-1',
    });
    vi.mocked(createAssistedDealerAction).mockResolvedValue({ ok: true, dealerId: 'd-1' });
    const user = userEvent.setup();
    render(<AssistedDealerStart widget={FAKE} />);

    expect(screen.getByText(/authorises Dealers-Drive to create and submit/)).toBeInTheDocument();
    await user.type(
      screen.getByLabelText('Dealer’s mobile number', { exact: false, selector: 'input' }),
      '9840012345',
    );
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Send OTP' }));
    await enterCode(user);
    await user.click(screen.getByRole('button', { name: /Verify/ }));

    await waitFor(() => {
      expect(verifyDealerPhoneAction).toHaveBeenCalledWith(
        '9840012345',
        expect.stringMatching(/^dev-otp:/),
        true,
      );
    });
    expect(await screen.findByText('Dealer’s mobile verified')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Continue to dealership details' }));
    await user.type(screen.getByLabelText(/Contact person/), 'Murugan');
    await user.click(screen.getByRole('button', { name: 'Create dealership' }));

    await waitFor(() => {
      expect(createAssistedDealerAction).toHaveBeenCalledWith(
        expect.objectContaining({ phoneTicket: 'ticket-1', contactName: 'Murugan' }),
      );
    });
    expect(navigationState.pushed).toContain('/sales/dealers/d-1');
  });
});
