'use client';

import Link from 'next/link';
import { Suspense } from 'react';

import type { DistrictScopedLinkProps } from './district-scoped-link.types';
import { ScopedLink } from './scoped-link';

export function DistrictScopedLink({ href, className, children }: DistrictScopedLinkProps) {
  return (
    <Suspense
      fallback={
        <Link href={href} className={className}>
          {children}
        </Link>
      }
    >
      <ScopedLink href={href} className={className}>
        {children}
      </ScopedLink>
    </Suspense>
  );
}
