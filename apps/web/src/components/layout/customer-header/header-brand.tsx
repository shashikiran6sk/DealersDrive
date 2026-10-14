import Link from 'next/link';

import { BrandLockup } from '@/components/brand-logo';
import { cn } from '@/lib/cn';

import { HEADER_NAV } from './customer-header.constants';

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
      <BrandLockup wordmarkClassName={labelClassName} />
    </Link>
  );
}
