import type { PhoneOtpWidget } from '@dealers-drive/contracts';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AssistedDealerStart } from '@/features/sales/assisted-dealer-start';
import {
  createAssistedDealerAction,
  sendDealerEmailCodeAction,
  verifyDealerEmailAction,
  verifyDealerPhoneAction,
} from '@/features/sales/sales-actions';

import { navigationState } from '../../../setup';

vi.mock('@/features/sales/sales-actions', () => ({
  verifyDealerPhoneAction: vi.fn(),
  createAssistedDealerAction: vi.fn(),
  sendDealerEmailCodeAction: vi.fn(),
  verifyDealerEmailAction: vi.fn(),
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
 * R112, revised by #299 — the first minutes of an assisted onboarding: the
 * dealer's consent and the code on their handset, the code in their inbox, and
 * only once both are proved the business details.
 */
beforeEach(() => {
  vi.mocked(verifyDealerPhoneAction).mockReset();
  vi.mocked(createAssistedDealerAction).mockReset();
  vi.mocked(sendDealerEmailCodeAction).mockReset();
  vi.mocked(verifyDealerEmailAction).mockReset();
  vi.mocked(verifyDealerPhoneAction).mockResolvedValue({
    verified: true,
    phone: '+919840012345',
    phoneDisplay: '+91 98400 12345',
    phoneTicket: 'ticket-1',
  });
  vi.mocked(sendDealerEmailCodeAction).mockResolvedValue({
    ok: true,
    email: 'selvi@gmail.com',
    challenge: 'challenge-1',
    resendAfterSeconds: 60,
  });
  vi.mocked(verifyDealerEmailAction).mockResolvedValue({
    ok: true,
    email: 'selvi@gmail.com',
    emailTicket: 'email-ticket-1',
  });
  navigationState.pushed.length = 0;
});

type User = ReturnType<typeof userEvent.setup>;

async function enterCode(user: User, groupName: string) {
  const group = await screen.findByRole('group', { name: groupName });
  const digits = within(group).getAllByLabelText(/^Digit /);
  for (const [index, digit] of digits.entries()) await user.type(digit, String(index + 1));
}

async function verifyPhone(user: User, { typeNumber = true } = {}) {
  if (typeNumber) {
    await user.type(
      screen.getByLabelText('Dealer’s mobile number', { exact: false, selector: 'input' }),
      '9840012345',
    );
    await user.click(screen.getByRole('checkbox'));
  }
  await user.click(screen.getByRole('button', { name: 'Send OTP' }));
  await enterCode(user, '6-digit verification code');
  await user.click(screen.getByRole('button', { name: 'Verify & continue' }));
  await screen.findByText('Dealer’s mobile verified');
}

async function verifyEmail(user: User, { typeEmail = true } = {}) {
  if (typeEmail) await user.type(screen.getByLabelText(/Dealer’s email/), 'selvi@gmail.com');
  await user.click(screen.getByRole('button', { name: 'Send code' }));
  await enterCode(user, '6-digit code from the email');
  await user.click(screen.getByRole('button', { name: 'Verify email' }));
  await screen.findByText('Dealer’s email verified');
}

describe('AssistedDealerStart', () => {
  it('offers to continue only once both the mobile and the email are verified', async () => {
    const user = userEvent.setup();
    render(<AssistedDealerStart widget={FAKE} />);

    expect(screen.getByText(/Step 1 of 3/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Continue to business details' })).toBeNull();

    await verifyPhone(user);
    expect(screen.queryByRole('button', { name: 'Continue to business details' })).toBeNull();
    expect(screen.getByText(/Verify both the mobile number and the email/)).toBeInTheDocument();

    await verifyEmail(user);
    expect(
      screen.getByRole('button', { name: 'Continue to business details' }),
    ).toBeInTheDocument();
  });

  it('does not continue on the email alone', async () => {
    const user = userEvent.setup();
    render(<AssistedDealerStart widget={FAKE} />);

    await verifyEmail(user);

    expect(screen.queryByRole('button', { name: 'Continue to business details' })).toBeNull();
  });

  it('creates the dealership with both tickets, then goes to the documents step', async () => {
    vi.mocked(createAssistedDealerAction).mockResolvedValue({ ok: true, dealerId: 'd-1' });
    const user = userEvent.setup();
    render(<AssistedDealerStart widget={FAKE} />);

    expect(screen.getByText(/authorises Dealers-Drive to create and submit/)).toBeInTheDocument();
    await verifyPhone(user);
    await waitFor(() => {
      expect(verifyDealerPhoneAction).toHaveBeenCalledWith(
        '9840012345',
        expect.stringMatching(/^dev-otp:/),
        true,
      );
    });
    await verifyEmail(user);

    await user.click(screen.getByRole('button', { name: 'Continue to business details' }));
    expect(screen.getByText(/Step 2 of 3/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Dealer’s email/)).toBeNull();
    await user.type(screen.getByLabelText(/Contact person/), 'Murugan');
    await user.click(screen.getByRole('button', { name: 'Save and continue' }));

    await waitFor(() => {
      expect(createAssistedDealerAction).toHaveBeenCalledWith(
        expect.objectContaining({
          phoneTicket: 'ticket-1',
          emailTicket: 'email-ticket-1',
          contactName: 'Murugan',
        }),
      );
    });
    const sent = vi.mocked(createAssistedDealerAction).mock.calls[0]?.[0];
    expect(sent).not.toHaveProperty('email');
    expect(navigationState.pushed).toContain('/sales/dealers/d-1/documents');
  });

  it('shows a refusal and keeps the details through verifying both again', async () => {
    vi.mocked(createAssistedDealerAction).mockResolvedValue({
      ok: false,
      message: 'The verification has expired. Verify the mobile and email again.',
    });
    const user = userEvent.setup();
    render(<AssistedDealerStart widget={FAKE} />);
    await verifyPhone(user);
    await verifyEmail(user);
    await user.click(screen.getByRole('button', { name: 'Continue to business details' }));
    await user.type(screen.getByLabelText(/Contact person/), 'Synthetic Representative');
    await user.click(screen.getByRole('button', { name: 'Save and continue' }));
    expect(await screen.findByText(/has expired/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Verify again' }));
    expect(screen.queryByRole('button', { name: 'Continue to business details' })).toBeNull();
    expect(screen.getByLabelText(/Dealer’s email/)).toHaveValue('selvi@gmail.com');

    await verifyPhone(user, { typeNumber: false });
    await verifyEmail(user, { typeEmail: false });
    await user.click(screen.getByRole('button', { name: 'Continue to business details' }));
    expect(screen.getByLabelText(/Contact person/)).toHaveValue('Synthetic Representative');
    expect(sendDealerEmailCodeAction).toHaveBeenCalledTimes(2);
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
});
