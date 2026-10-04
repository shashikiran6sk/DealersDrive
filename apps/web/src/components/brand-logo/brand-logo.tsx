import Image from 'next/image';

import { cn } from '@/lib/cn';

import { BRAND_LOGO } from './brand-logo.constants';

export interface BrandLogoProps {
  variant?: 'light' | 'dark';
  size?: number;
  className?: string;
}

export function BrandLogo({ variant = 'light', size = 30, className }: BrandLogoProps) {
  return (
    <Image
      src={BRAND_LOGO[variant]}
      alt={BRAND_LOGO.alt}
      width={size}
      height={size}
      unoptimized
      className={cn('inline-block flex-none rounded-[25%] object-contain align-middle', className)}
    />
  );
}
