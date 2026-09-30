import { SocialIcon } from '@/components/layout/social-icons';
import { Button } from '@/components/ui/button';

import { GET_OTP_TEXT } from './get-otp-button.constants';
import type { GetOtpButtonProps } from './get-otp-button.types';

export function GetOtpButton({ channel, ...button }: GetOtpButtonProps) {
  const whatsapp = channel === 'whatsapp';

  return (
    <Button variant="primary" size="md" block data-channel={channel} {...button}>
      {whatsapp ? (
        <span data-slot="whatsapp-icon" className="inline-flex">
          <SocialIcon network="whatsapp" />
        </span>
      ) : null}
      {GET_OTP_TEXT.label}
      {whatsapp ? (
        <>
          {' '}
          <span className="sr-only">{GET_OTP_TEXT.onWhatsApp}</span>
        </>
      ) : null}
    </Button>
  );
}
