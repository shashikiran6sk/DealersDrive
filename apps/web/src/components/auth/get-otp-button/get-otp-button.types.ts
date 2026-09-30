import type { OtpChannel } from '@dealers-drive/contracts';

import type { ButtonProps } from '@/components/ui/button';

export type GetOtpButtonProps = Omit<ButtonProps, 'children' | 'variant' | 'size' | 'block'> & {
  channel: OtpChannel;
};
