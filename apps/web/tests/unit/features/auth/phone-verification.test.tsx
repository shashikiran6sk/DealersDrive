import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PhoneVerification } from '@/features/auth/phone-verification';
import type * as PhoneActions from '@/features/auth/phone-actions';

const start = vi.fn<typeof PhoneActions.startPhoneVerificationAction>();
const verify = vi.fn<typeof PhoneActions.verifyPhoneAction>();
vi.mock('@/features/auth/phone-actions', () => ({
  startPhoneVerificationAction: (phone: string) => start(phone),
  verifyPhoneAction: (id: string, code: string) => verify(id, code),
}));
const challengeId = '10000000-0000-4000-8000-000000000001';
beforeEach(() => {
  vi.clearAllMocks();
  start.mockResolvedValue({
    phone: '+919840012345',
    phoneDisplay: '+91 98400 12345',
    challengeId,
    resendAfterSeconds: 60,
  });
  verify.mockResolvedValue({
    verified: true,
    phone: '+919840012345',
    phoneDisplay: '+91 98400 12345',
  });
});
function view(props: Partial<React.ComponentProps<typeof PhoneVerification>> = {}) {
  return render(
    <form>
      <PhoneVerification verified={false} {...props} />
    </form>,
  );
}
async function send() {
  const user = userEvent.setup();
  await user.type(screen.getByRole('textbox', { name: /mobile/i }), '9840012345');
  await user.click(screen.getByRole('button', { name: 'Send code' }));
  await screen.findByPlaceholderText('6-digit code');
  return user;
}
describe('managed OTP field', () => {
  it('sends via the server and confirms the opaque challenge', async () => {
    const { container } = view();
    const user = await send();
    expect(start).toHaveBeenCalledWith('9840012345');
    expect(screen.getByRole('button', { name: /Resend in/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Verify' })).toBeDisabled();
    await user.type(screen.getByPlaceholderText('6-digit code'), '123456');
    await user.click(screen.getByRole('button', { name: 'Verify' }));
    await screen.findByText('Verified');
    expect(verify).toHaveBeenCalledWith(challengeId, '123456');
    expect(container.querySelector('input[name="phoneVerified"]')).toHaveValue('true');
  });
  it('does not advance or create a verified flag when sending fails', async () => {
    start.mockResolvedValue({ fieldError: 'Already registered.' });
    const { container } = view();
    const user = userEvent.setup();
    await user.type(screen.getByRole('textbox', { name: /mobile/i }), '9840012345');
    await user.click(screen.getByRole('button', { name: 'Send code' }));
    await screen.findByText('Already registered.');
    expect(screen.queryByPlaceholderText('6-digit code')).not.toBeInTheDocument();
    expect(container.querySelector('input[name="phoneVerified"]')).toHaveValue('');
  });
  it.each(['That code is not right.', 'That code has expired.', 'Too many attempts.'])(
    'keeps the input available after %s',
    async (error) => {
      verify.mockResolvedValue({ error });
      view();
      const user = await send();
      await user.type(screen.getByPlaceholderText('6-digit code'), '123456');
      await user.click(screen.getByRole('button', { name: 'Verify' }));
      expect(await screen.findByRole('alert')).toHaveTextContent(error);
      expect(screen.queryByText('Verified')).not.toBeInTheDocument();
    },
  );
  it('disables sending when configuration is unavailable', () => {
    view({ phoneVerificationEnabled: false, initialPhone: '+919840012345' });
    expect(screen.getByRole('button', { name: 'Send code' })).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('temporarily unavailable');
    expect(start).not.toHaveBeenCalled();
  });
  it('allows a new code after cooldown and verifies the replacement challenge', async () => {
    view();
    const user = await send();
    const now = Date.now();
    const date = vi.spyOn(Date, 'now').mockReturnValue(now + 61000);
    try {
      await waitFor(
        () => expect(screen.getByRole('button', { name: 'Send it again' })).toBeEnabled(),
        { timeout: 2000 },
      );
      start.mockResolvedValue({
        phone: '+919840012345',
        challengeId: 'replacement',
        resendAfterSeconds: 60,
      });
      await user.click(screen.getByRole('button', { name: 'Send it again' }));
      await user.type(screen.getByPlaceholderText('6-digit code'), '123456');
      await user.click(screen.getByRole('button', { name: 'Verify' }));
      await screen.findByText('Verified');
      expect(verify).toHaveBeenCalledWith('replacement', '123456');
    } finally {
      date.mockRestore();
    }
  });
  it('changing a verified number clears the form gate', async () => {
    const { container } = view({
      verified: true,
      initialPhone: '+919840012345',
      initialPhoneDisplay: '+91 98400 12345',
    });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Change' }));
    expect(container.querySelector('input[name="phoneVerified"]')).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Send code' })).toBeInTheDocument();
  });
  it('shows a transport failure without losing the phone input', async () => {
    start.mockRejectedValue(new Error('network'));
    view({ initialPhone: '+919840012345' });
    await userEvent.setup().click(screen.getByRole('button', { name: 'Send code' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('API is unavailable');
  });
  it('blocks a second click while a send is in flight', async () => {
    let finish!: (value: PhoneActions.PhoneState) => void;
    start.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    view({ initialPhone: '+919840012345' });
    await userEvent.setup().dblClick(screen.getByRole('button', { name: 'Send code' }));
    expect(start).toHaveBeenCalledTimes(1);
    await act(async () => {
      finish({ phone: '+919840012345', challengeId });
      await Promise.resolve();
    });
  });
});
