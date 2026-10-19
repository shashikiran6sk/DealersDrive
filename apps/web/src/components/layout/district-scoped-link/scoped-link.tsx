'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

import type { DistrictScopedLinkProps } from './district-scoped-link.types';
import { scopedHref } from './utils';

export function ScopedLink({ href, className, children }: DistrictScopedLinkProps) {
  const district = useSearchParams().get('district');
  return (
    <Link href={scopedHref(href, district)} className={className}>
      {children}
    </Link>
  );
}
