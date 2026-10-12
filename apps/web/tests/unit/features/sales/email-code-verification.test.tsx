import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EmailCodeVerification } from '@/features/sales/email-code-verification';
import { sendDealerEmailCodeAction, verifyDealerEmailAction } from '@/features/sales/sales-actions';

vi.mock('@/features/sales/sales-actions', () => ({
  sendDealerEmailCodeAction: vi.fn(),
  verifyDealerEmailAction: vi.fn(),
}));

/**
 * #299 — the email half of Step 1. The dealer reads out a code that only the
 * inbox received; the representative never sees anything that would prove the
 * address on its own.
 */
beforeEach(() => {
  vi.mocked(sendDealerEmailCodeAction).mockReset();
  vi.mocked(verifyDealerEmailAction).mockReset();
});

async function enterCode(user: ReturnType<typeof userEvent.setup>, code: string) {
  const group = await screen.findByRole('group', { name: '6-digit code from the email' });
  const digits = within(group).getAllByLabelText(/^Digit /);
  for (const [index, digit] of digits.entries()) await user.type(digit, code[index] ?? '');
}

describe('EmailCodeVerification', () => {
  it('sends a code, verifies it, and hands back the ticket', async () => {
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
    const onVerified = vi.fn();
    const user = userEvent.setup();
    render(<EmailCodeVerification onVerified={onVerified} />);

    await user.type(screen.getByLabelText(/Dealer’s email/), 'Selvi@Gmail.com');
    await user.click(screen.getByRole('button', { name: 'Send code' }));

    await waitFor(() => {
      expect(sendDealerEmailCodeAction).toHaveBeenCalledWith('selvi@gmail.com');
    });
    expect(
      await screen.findByText(/We sent a 6-digit code to selvi@gmail.com/),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Verify email' })).toBeDisabled();

    await enterCode(user, '123456');
    await user.click(screen.getByRole('button', { name: 'Verify email' }));

    await waitFor(() => {
      expect(verifyDealerEmailAction).toHaveBeenCalledWith('challenge-1', '123456');
    });
    expect(await screen.findByText('Dealer’s email verified')).toBeInTheDocument();
    expect(onVerified).toHaveBeenCalledWith({
      email: 'selvi@gmail.com',
      emailTicket: 'email-ticket-1',
    });
    expect(screen.getByLabelText(/Dealer’s email/)).toHaveAttribute('readonly');
  });

  it('refuses an invalid address before calling the API', async () => {
    const user = userEvent.setup();
    render(<EmailCodeVerification onVerified={vi.fn()} />);

    await user.type(screen.getByLabelText(/Dealer’s email/), 'not-an-email');
    await user.click(screen.getByRole('button', { name: 'Send code' }));

    expect(await screen.findByText('Enter a valid email address.')).toBeInTheDocument();
    expect(sendDealerEmailCodeAction).not.toHaveBeenCalled();
  });

  it('shows the API’s refusal to send', async () => {
    vi.mocked(sendDealerEmailCodeAction).mockResolvedValue({
      ok: false,
      message: 'This email address is already associated with a dealer account.',
    });
    const user = userEvent.setup();
    render(<EmailCodeVerification onVerified={vi.fn()} initialEmail="taken@example.test" />);

    await user.click(screen.getByRole('button', { name: 'Send code' }));

    expect(await screen.findByText(/already associated with a dealer account/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Dealer’s email/)).toHaveAttribute('aria-invalid', 'true');
    expect(screen.queryByRole('group', { name: '6-digit code from the email' })).toBeNull();
  });

  it('says so when the code is wrong, and does not hand anything back', async () => {
    vi.mocked(sendDealerEmailCodeAction).mockResolvedValue({
      ok: true,
      email: 'selvi@gmail.com',
      challenge: 'challenge-1',
      resendAfterSeconds: 60,
    });
    vi.mocked(verifyDealerEmailAction).mockResolvedValue({
      ok: false,
      message: 'That code is not right. Check the email and try again.',
    });
    const onVerified = vi.fn();
    const user = userEvent.setup();
    render(<EmailCodeVerification onVerified={onVerified} initialEmail="selvi@gmail.com" />);

    await user.click(screen.getByRole('button', { name: 'Send code' }));
    await enterCode(user, '000000');
    await user.click(screen.getByRole('button', { name: 'Verify email' }));

    expect(await screen.findByText('That code did not match')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(/That code is not right/);
    expect(onVerified).not.toHaveBeenCalled();
  });

  describe('the resend countdown', () => {
    beforeEach(() => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('holds “Send a new code” until the API’s cooldown has passed', async () => {
      vi.mocked(sendDealerEmailCodeAction).mockResolvedValue({
        ok: true,
        email: 'selvi@gmail.com',
        challenge: 'challenge-1',
        resendAfterSeconds: 60,
      });
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) });
      render(<EmailCodeVerification onVerified={vi.fn()} initialEmail="selvi@gmail.com" />);

      await user.click(screen.getByRole('button', { name: 'Send code' }));

      const resend = await screen.findByRole('button', { name: 'Send a new code' });
      expect(resend).toBeDisabled();
      expect(screen.getByText(/You can send a new code in 0[01]:\d\d/)).toBeInTheDocument();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(61_000);
      });
      expect(screen.getByRole('button', { name: 'Send a new code' })).toBeEnabled();

      await user.click(screen.getByRole('button', { name: 'Send a new code' }));
      await waitFor(() => {
        expect(sendDealerEmailCodeAction).toHaveBeenCalledTimes(2);
      });
      expect(await screen.findByText(/A new code is on its way/)).toBeInTheDocument();
    });
  });
});
