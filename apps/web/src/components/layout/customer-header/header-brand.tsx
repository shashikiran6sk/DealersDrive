import Link from 'next/link';

import { BrandLogo } from '@/components/brand-logo';
import { cn } from '@/lib/cn';

import { HEADER_NAV, HEADER_TEXT } from './customer-header.constants';

export interface HeaderBrandProps {
  className?: string;
  labelClassName?: string;
}

export function HeaderBrand({ className, labelClassName }: HeaderBrandProps) {
  return (
    <Link
      href={HEADER_NAV.home}
      className={cn('flex flex-none items-center gap-[10px]', className)}
    >
      <BrandLogo variant="dark" />
      <span
        className={cn('font-heading text-[17px] font-extrabold tracking-[-0.02em]', labelClassName)}
      >
        {HEADER_TEXT.brand}
      </span>
    </Link>
  );
}
