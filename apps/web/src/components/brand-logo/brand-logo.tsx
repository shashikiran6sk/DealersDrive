import Image from 'next/image';

import { cn } from '@/lib/cn';

import { BRAND_LOGO } from './brand-logo.constants';

export interface BrandLogoProps {
  variant?: 'light' | 'dark';
  size?: number;
  className?: string;
  ariaLabel?: string;
}

export function BrandLogo({
  variant = 'light',
  size = 30,
  className,
  ariaLabel = BRAND_LOGO.alt,
}: BrandLogoProps) {
  return (
    <Image
      src={BRAND_LOGO[variant]}
      alt={ariaLabel}
      width={Math.round((size * 651) / 424)}
      height={size}
      unoptimized
      className={cn('inline-block flex-none object-contain align-middle', className)}
    />
  );
}
