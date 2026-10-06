import type { DealerClaimPreview, PhoneOtpWidget } from '@dealers-drive/contracts';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { claimDealershipAction, confirmClaimEmailAction } from '@/features/claim/claim-actions';
import { ClaimDealership } from '@/features/claim/claim-dealership';

import { navigationState } from '../../../setup';

vi.mock('@/features/claim/claim-actions', () => ({
  confirmClaimEmailAction: vi.fn(),
  claimDealershipAction: vi.fn(),
}));

const FAKE: PhoneOtpWidget = {
  enabled: true,
  driver: 'fake',
  widgetId: null,
  tokenAuth: null,
  devCode: '123456',
  reason: null,
};

const TOKEN = 'a'.repeat(43);

function preview(overrides: Partial<DealerClaimPreview> = {}): DealerClaimPreview {
  return {
    state: 'AWAITING_EMAIL',
    dealerName: 'Claimable Motors',
    city: 'Katpadi',
    district: 'Vellore',
    emailMasked: 's••••@gmail.com',
    phoneMasked: '+91 ••••• •2345',
    phoneLast4: '2345',
    assistedBy: 'Arun',
    expiresAt: '2026-10-09T10:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  vi.mocked(confirmClaimEmailAction).mockReset();
  vi.mocked(claimDealershipAction).mockReset();
  navigationState.replaced.length = 0;
});

async function enterCode(user: ReturnType<typeof userEvent.setup>) {
  const digits = await screen.findAllByLabelText(/^Digit /);
  for (const [index, digit] of digits.entries()) await user.type(digit, String(index + 1));
}

/** R113 — the dealer's side of an assisted onboarding: confirm the email, then claim by OTP. */
describe('ClaimDealership', () => {
  it('asks for the email first, showing only the masked address', async () => {
    vi.mocked(confirmClaimEmailAction).mockResolvedValue({
      preview: preview({ state: 'AWAITING_CLAIM' }),
    });
    const user = userEvent.setup();
    render(<ClaimDealership token={TOKEN} preview={preview()} widget={FAKE} />);

    expect(screen.getByText(/s••••@gmail.com/)).toBeInTheDocument();
    expect(screen.getByText(/Set up with you by Arun/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Dealership mobile number/)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Confirm this is my email' }));
    await waitFor(() => {
      expect(confirmClaimEmailAction).toHaveBeenCalledWith(TOKEN);
    });
    expect(
      await screen.findByLabelText(/Dealership mobile number/, { selector: 'input' }),
    ).toBeInTheDocument();
  });

  it('shows the API’s refusal when the email cannot be confirmed', async () => {
    vi.mocked(confirmClaimEmailAction).mockResolvedValue({ error: 'This link has expired.' });
    const user = userEvent.setup();
    render(<ClaimDealership token={TOKEN} preview={preview()} widget={FAKE} />);
    await user.click(screen.getByRole('button', { name: 'Confirm this is my email' }));
    expect(await screen.findByText('This link has expired.')).toBeInTheDocument();
  });

  it('will not send a code to a number that is not the dealership’s', async () => {
    const user = userEvent.setup();
    render(
      <ClaimDealership
        token={TOKEN}
        preview={preview({ state: 'AWAITING_CLAIM' })}
        widget={FAKE}
      />,
    );
    await user.type(
      screen.getByLabelText(/Dealership mobile number/, { selector: 'input' }),
      '9840099999',
    );
    await user.click(screen.getByRole('button', { name: 'Send OTP' }));
    expect(await screen.findByText('Enter the number ending in 2345.')).toBeInTheDocument();
    expect(screen.queryAllByLabelText(/^Digit /)).toHaveLength(0);
  });

  it('claims with the OTP and opens the dealership', async () => {
    vi.mocked(claimDealershipAction).mockResolvedValue({ verified: true, returnTo: '/dealer' });
    const user = userEvent.setup();
    render(
      <ClaimDealership
        token={TOKEN}
        preview={preview({ state: 'AWAITING_CLAIM' })}
        widget={FAKE}
      />,
    );
    await user.type(
      screen.getByLabelText(/Dealership mobile number/, { selector: 'input' }),
      '9840012345',
    );
    await user.click(screen.getByRole('button', { name: 'Send OTP' }));
    await enterCode(user);
    await user.click(screen.getByRole('button', { name: /Verify/ }));

    await waitFor(() => {
      expect(claimDealershipAction).toHaveBeenCalledWith(
        TOKEN,
        '9840012345',
        expect.stringMatching(/^dev-otp:/),
      );
    });
    await waitFor(() => {
      expect(navigationState.replaced).toContain('/dealer');
    });
  });

  it.each([
    ['CLAIMED', 'This dealership already has an owner'],
    ['EXPIRED', 'This link has expired'],
    ['SUPERSEDED', 'A newer link has been sent'],
  ] as const)('explains a %s link and offers no form', (state, title) => {
    render(<ClaimDealership token={TOKEN} preview={preview({ state })} widget={FAKE} />);
    expect(screen.getByText(title)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Confirm this is my email' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Send OTP' })).toBeNull();
  });
});
