import type { PhoneOtpWidget } from '@dealers-drive/contracts';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  sendDealerEmailCodeAction,
  verifyAssistedDealerOwnerAction,
  verifyDealerEmailAction,
  verifyDealerPhoneAction,
} from '@/features/sales/sales-actions';
import { VerifyOwnerPanel } from '@/features/sales/verify-owner-panel';

import { navigationState } from '../../../setup';

vi.mock('@/features/sales/sales-actions', () => ({
  verifyDealerPhoneAction: vi.fn(),
  sendDealerEmailCodeAction: vi.fn(),
  verifyDealerEmailAction: vi.fn(),
  verifyAssistedDealerOwnerAction: vi.fn(),
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
 * #299 — "Verify now" for an assisted dealership created before verify-first:
 * the dealership's own number, then an email, then the owner is linked.
 */
beforeEach(() => {
  vi.mocked(verifyDealerPhoneAction).mockReset().mockResolvedValue({
    verified: true,
    phone: '+919840012345',
    phoneTicket: 'ticket-1',
  });
  vi.mocked(sendDealerEmailCodeAction).mockReset().mockResolvedValue({
    ok: true,
    email: 'selvi@gmail.com',
    challenge: 'challenge-1',
    resendAfterSeconds: 60,
  });
  vi.mocked(verifyDealerEmailAction).mockReset().mockResolvedValue({
    ok: true,
    email: 'selvi@gmail.com',
    emailTicket: 'email-ticket-1',
  });
  vi.mocked(verifyAssistedDealerOwnerAction).mockReset();
  navigationState.refreshed = 0;
});

async function enterCode(user: ReturnType<typeof userEvent.setup>, groupName: string) {
  const group = await screen.findByRole('group', { name: groupName });
  const digits = within(group).getAllByLabelText(/^Digit /);
  for (const [index, digit] of digits.entries()) await user.type(digit, String(index + 1));
}

function renderPanel() {
  render(
    <VerifyOwnerPanel
      dealerId="d-1"
      phone="+919840012345"
      phoneDisplay="+91 98400 12345"
      widget={FAKE}
    />,
  );
}

describe('VerifyOwnerPanel', () => {
  it('needs consent before the code goes to the dealership’s number', async () => {
    const user = userEvent.setup();
    renderPanel();

    expect(screen.getByDisplayValue('+91 98400 12345')).toHaveAttribute('readonly');
    await user.click(screen.getByRole('button', { name: 'Send OTP' }));

    expect(await screen.findByText(/tick the box/)).toBeInTheDocument();
  });

  it('links the owner once the mobile and the email are both verified', async () => {
    vi.mocked(verifyAssistedDealerOwnerAction).mockResolvedValue({ ok: true, dealerId: 'd-1' });
    const user = userEvent.setup();
    renderPanel();

    const link = screen.getByRole('button', { name: 'Verify and link the owner' });
    expect(link).toBeDisabled();

    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Send OTP' }));
    await enterCode(user, '6-digit verification code');
    await user.click(screen.getByRole('button', { name: 'Verify & continue' }));
    await screen.findByText('Dealership’s mobile verified');
    await waitFor(() => {
      expect(verifyDealerPhoneAction).toHaveBeenCalledWith(
        '+919840012345',
        expect.any(String),
        true,
      );
    });
    expect(link).toBeDisabled();

    await user.type(screen.getByLabelText(/Dealer’s email/), 'selvi@gmail.com');
    await user.click(screen.getByRole('button', { name: 'Send code' }));
    await enterCode(user, '6-digit code from the email');
    await user.click(screen.getByRole('button', { name: 'Verify email' }));
    await screen.findByText('Dealer’s email verified');

    await user.click(screen.getByRole('button', { name: 'Verify and link the owner' }));
    await waitFor(() => {
      expect(verifyAssistedDealerOwnerAction).toHaveBeenCalledWith('d-1', {
        phoneTicket: 'ticket-1',
        emailTicket: 'email-ticket-1',
      });
    });
    expect(await screen.findByText(/The dealer can now sign in/)).toBeInTheDocument();
    expect(navigationState.refreshed).toBeGreaterThan(0);
  });
});
