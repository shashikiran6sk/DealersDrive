import type { SalesEmailVerification } from '@dealers-drive/contracts';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { EmailVerificationPanel } from '@/features/sales/email-verification-panel';
import { resendVerificationAction } from '@/features/sales/sales-actions';

vi.mock('@/features/sales/sales-actions', () => ({
  resendVerificationAction: vi.fn(() => Promise.resolve({ ok: true })),
}));

function verification(overrides: Partial<SalesEmailVerification> = {}): SalesEmailVerification {
  return {
    email: 'selvi@gmail.com',
    sentAt: '2026-10-06T10:00:00.000Z',
    expiresAt: '2999-10-09T10:00:00.000Z',
    verifiedAt: null,
    claimedAt: null,
    canResend: true,
    ...overrides,
  };
}

describe('EmailVerificationPanel', () => {
  it('says where the link went, and resends on request', async () => {
    const user = userEvent.setup();
    render(<EmailVerificationPanel dealerId="d-1" verification={verification()} />);
    expect(screen.getByText(/Verification link sent to selvi@gmail.com/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Send a new link' }));
    await waitFor(() => {
      expect(resendVerificationAction).toHaveBeenCalledWith('d-1');
    });
    expect(await screen.findByText(/The old one no longer works/)).toBeInTheDocument();
  });

  it('holds the button during the cooldown', () => {
    render(
      <EmailVerificationPanel dealerId="d-1" verification={verification({ canResend: false })} />,
    );
    expect(screen.getByRole('button', { name: 'Send a new link' })).toBeDisabled();
  });

  it('flags an expired link, and stops once the dealer has claimed', () => {
    const { rerender } = render(
      <EmailVerificationPanel
        dealerId="d-1"
        verification={verification({ expiresAt: '2000-01-01T00:00:00.000Z' })}
      />,
    );
    expect(screen.getByText(/The last link has expired/)).toBeInTheDocument();

    rerender(
      <EmailVerificationPanel
        dealerId="d-1"
        verification={verification({
          verifiedAt: '2026-10-06T11:00:00.000Z',
          claimedAt: '2026-10-06T11:05:00.000Z',
        })}
      />,
    );
    expect(screen.getByText(/claimed this dealership/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Send a new link' })).toBeNull();
  });
});
