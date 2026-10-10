import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminPhone } from '@/features/auth/admin-phone/admin-phone';
import { startAdminPhoneChallenge, verifyAdminPhone } from '@/features/auth/admin-phone/actions';
vi.mock('@/features/auth/admin-phone/actions', () => ({
  startAdminPhoneChallenge: vi.fn(),
  verifyAdminPhone: vi.fn(),
}));
const widget = {
  enabled: true,
  driver: 'fake',
  widgetId: null,
  tokenAuth: null,
  devCode: '123456',
  reason: null,
} as const;
const challenge = {
  challengeId: '11111111-1111-4111-8111-111111111111',
  browserToken: 'a'.repeat(43),
  expiresAt: new Date(Date.now() + 300_000).toISOString(),
  resendAfterSeconds: 60,
};
beforeEach(() => {
  vi.mocked(startAdminPhoneChallenge).mockReset().mockResolvedValue({ challenge });
  vi.mocked(verifyAdminPhone).mockReset().mockResolvedValue({});
});
describe('admin mobile challenge UI', () => {
  it('requires a successful backend challenge before displaying the OTP entry', async () => {
    vi.mocked(startAdminPhoneChallenge).mockResolvedValue({ error: 'Continue with Google again.' });
    render(<AdminPhone mode="ENROLL" widget={widget} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/Mobile number/), '9000001234');
    await user.click(screen.getByRole('button', { name: 'Send OTP' }));
    expect(await screen.findByText('Continue with Google again.')).toBeVisible();
    expect(screen.queryAllByLabelText(/^Digit /)).toHaveLength(0);
  });
  it('passes the browser-bound challenge and provider proof to enrollment', async () => {
    render(<AdminPhone mode="ENROLL" widget={widget} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/Mobile number/), '9000001234');
    await user.click(screen.getByRole('button', { name: 'Send OTP' }));
    const digits = await screen.findAllByLabelText(/^Digit /);
    await waitFor(() => {
      expect(digits[0]).toBeEnabled();
    });
    await user.type(digits[0]!, '123456');
    await user.click(screen.getByRole('button', { name: 'Verify and link mobile' }));
    expect(await screen.findByText(/Mobile number verified and linked/)).toBeVisible();
    expect(verifyAdminPhone).toHaveBeenCalledWith(
      'ENROLL',
      expect.objectContaining({
        challengeId: challenge.challengeId,
        browserToken: challenge.browserToken,
      }),
    );
    expect(vi.mocked(verifyAdminPhone).mock.calls[0]?.[1]).toHaveProperty('accessToken');
  }, 15_000);
  it('shows unavailable mobile delivery without removing the surrounding Google flow', () => {
    render(
      <AdminPhone
        mode="LOGIN"
        widget={{ ...widget, enabled: false, reason: 'Mobile unavailable' }}
      />,
    );
    expect(screen.getByText(/Mobile unavailable/)).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Send OTP' })).toBeNull();
  });
});
