import { cn } from '@/lib/cn';

import { BrandLogo, type BrandLogoProps } from './brand-logo';
import { BRAND_LOGO } from './brand-logo.constants';
import { BrandWordmark } from './brand-wordmark';

interface BrandLockupProps extends Pick<BrandLogoProps, 'variant' | 'size' | 'className'> {
  wordmarkClassName?: string;
}

export function BrandLockup({
  variant = 'light',
  size = 30,
  className,
  wordmarkClassName,
}: BrandLockupProps) {
  return (
    <span
      role="img"
      aria-label={BRAND_LOGO.name}
      className={cn('inline-flex flex-none items-center gap-[10px]', className)}
    >
      <BrandLogo variant={variant} size={size} ariaLabel="" />
      <BrandWordmark variant={variant} className={wordmarkClassName} ariaLabel="" />
    </span>
  );
}
