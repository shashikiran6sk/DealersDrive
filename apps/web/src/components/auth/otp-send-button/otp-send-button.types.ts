import type { ButtonProps } from '@/components/ui/button';

export type OtpSendButtonProps = Omit<ButtonProps, 'variant' | 'size' | 'block'> & {
  whatsapp?: boolean;
};
