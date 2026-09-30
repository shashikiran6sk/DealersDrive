import { SocialIcon } from '@/components/layout/social-icons';
import { Button } from '@/components/ui/button';

import { OTP_SEND_TEXT } from './otp-send-button.constants';
import type { OtpSendButtonProps } from './otp-send-button.types';

export function OtpSendButton({ whatsapp = false, children, ...button }: OtpSendButtonProps) {
  return (
    <Button variant="primary" size="md" block {...button}>
      {whatsapp ? (
        <span data-slot="whatsapp-icon" className="inline-flex">
          <SocialIcon network="whatsapp" />
        </span>
      ) : null}
      {children}
      {whatsapp ? (
        <>
          {' '}
          <span className="sr-only">{OTP_SEND_TEXT.onWhatsApp}</span>
        </>
      ) : null}
    </Button>
  );
}
