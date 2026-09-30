import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';

import { OTP_SEND_TEXT } from './otp-send-button.constants';
import type { OtpSendButtonProps } from './otp-send-button.types';
import { WhatsAppMark } from './whatsapp-mark';

export function OtpSendButton({
  whatsapp = false,
  children,
  className,
  ...button
}: OtpSendButtonProps) {
  return (
    <Button
      variant="primary"
      size="md"
      block
      className={cn(whatsapp && 'gap-[12px]', className)}
      {...button}
    >
      {whatsapp ? (
        <span data-slot="whatsapp-icon" className="inline-flex flex-none">
          <WhatsAppMark />
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
