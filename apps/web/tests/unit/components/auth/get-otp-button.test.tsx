import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { GetOtpButton } from '@/components/auth/get-otp-button';

/**
 * The one OTP button every phone flow uses. It reads "Get OTP" whichever way
 * the code travels, and carries the WhatsApp mark only when the server says
 * this code will arrive on WhatsApp (`PhoneOtpWidget.channel`) — never
 * because a component decided so for itself.
 */
describe('GetOtpButton', () => {
  it('shows the WhatsApp mark and Get OTP when the code goes by WhatsApp', () => {
    render(<GetOtpButton channel="whatsapp" />);
    const button = screen.getByRole('button', { name: 'Get OTP on WhatsApp' });
    expect(button).toHaveTextContent(/Get OTP/);
    expect(button.querySelector('[data-slot="whatsapp-icon"] svg')).not.toBeNull();
    expect(button.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    expect(button).toHaveAttribute('data-channel', 'whatsapp');
  });

  it('shows Get OTP alone, with no WhatsApp mark, when the code goes by SMS', () => {
    render(<GetOtpButton channel="sms" />);
    const button = screen.getByRole('button', { name: 'Get OTP' });
    expect(button.querySelector('[data-slot="whatsapp-icon"]')).toBeNull();
    expect(button.querySelector('svg')).toBeNull();
    expect(screen.queryByText(/Send OTP/)).toBeNull();
  });

  it('is the primary block button, and passes the rest through', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(<GetOtpButton channel="sms" type="submit" onClick={onClick} />);
    const button = screen.getByRole('button', { name: 'Get OTP' });
    expect(button).toHaveClass('btn-primary', 'btn-block');
    expect(button).toHaveAttribute('type', 'submit');
    await user.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('takes the shared button’s loading state while the code is being sent', () => {
    render(<GetOtpButton channel="whatsapp" loading />);
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
  });
});
