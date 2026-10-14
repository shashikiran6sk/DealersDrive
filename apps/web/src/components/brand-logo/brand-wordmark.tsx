import Image from 'next/image';

import { cn } from '@/lib/cn';

import { BRAND_LOGO, BRAND_WORDMARK } from './brand-logo.constants';
import type { BrandLogoProps } from './brand-logo';

export function BrandWordmark({
  variant = 'light',
  className,
  ariaLabel = BRAND_LOGO.alt,
}: Pick<BrandLogoProps, 'variant' | 'className' | 'ariaLabel'>) {
  return (
    <Image
      src={BRAND_WORDMARK[variant]}
      alt={ariaLabel}
      width={1092}
      height={145}
      unoptimized
      className={cn('inline-block h-auto w-[136px] flex-none object-contain', className)}
    />
  );
}
