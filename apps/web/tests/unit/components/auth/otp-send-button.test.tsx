import type { PhoneOtpWidget } from '@dealers-drive/contracts';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { OtpSendButton } from '@/components/auth/otp-send-button';
import { PhoneSignIn } from '@/features/auth/phone-sign-in';
import { PhoneVerification } from '@/features/auth/phone-verification';

vi.mock('@/features/auth/phone-actions', () => ({
  checkPhoneAvailabilityAction: vi.fn(),
  verifyPhoneAction: vi.fn(),
}));

/**
 * The WhatsApp OTP switch as the browser sees it: one boolean from
 * `GET /v1/config/public` decides whether the OTP button carries the WhatsApp
 * logo. The label, the button and the flow are otherwise the same.
 */
const FAKE: PhoneOtpWidget = {
  enabled: true,
  driver: 'fake',
  widgetId: null,
  tokenAuth: null,
  devCode: '123456',
  reason: null,
};

function logo(): Element | null {
  return document.querySelector('[data-slot="whatsapp-icon"]');
}

describe('OtpSendButton', () => {
  it('carries the WhatsApp logo, hidden from assistive technology, when on', () => {
    render(<OtpSendButton whatsapp>Send OTP</OtpSendButton>);

    const button = screen.getByRole('button', { name: 'Send OTP on WhatsApp' });
    const icon = logo();
    expect(icon).not.toBeNull();
    expect(button).toContainElement(icon instanceof HTMLElement ? icon : null);
    expect(icon?.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('carries no logo when off, and keeps its plain name', () => {
    render(<OtpSendButton>Send OTP</OtpSendButton>);

    expect(screen.getByRole('button', { name: 'Send OTP' })).toBeInTheDocument();
    expect(logo()).toBeNull();
  });

  it('is the primary, full-width button either way', () => {
    render(<OtpSendButton whatsapp>Send OTP</OtpSendButton>);

    expect(screen.getByRole('button').className).toContain('btn-block');
  });
});

describe('the OTP buttons that read the switch', () => {
  it('sign-in shows the logo only when the switch is on', () => {
    const { unmount } = render(
      <PhoneSignIn widget={FAKE} idPrefix="t" onProved={vi.fn()} whatsappOtp />,
    );
    expect(logo()).not.toBeNull();
    unmount();

    render(<PhoneSignIn widget={FAKE} idPrefix="t" onProved={vi.fn()} />);
    expect(logo()).toBeNull();
    expect(screen.getByRole('button', { name: 'Send OTP' })).toBeInTheDocument();
  });

  it('onboarding’s mobile check shows the logo only when the switch is on', () => {
    const props = {
      widget: FAKE,
      phone: '9840012345',
      fullName: 'R. Manikandan',
      verified: false,
      onVerified: vi.fn(),
      onContinue: vi.fn(),
      onBeforeSend: vi.fn(() => true),
    };

    const { unmount } = render(<PhoneVerification {...props} whatsappOtp />);
    expect(screen.getByRole('button', { name: 'Send OTP on WhatsApp' })).toBeInTheDocument();
    unmount();

    render(<PhoneVerification {...props} whatsappOtp={false} />);
    expect(logo()).toBeNull();
    expect(screen.getByRole('button', { name: 'Send OTP' })).toBeInTheDocument();
  });
});
