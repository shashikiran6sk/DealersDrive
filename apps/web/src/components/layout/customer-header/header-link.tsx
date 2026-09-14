'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

/**
 * `aria-current="page"` as well as the colour, because status is never carried
 * by colour alone (DESIGN-SPEC §4.15).
 */
export function HeaderLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(active && 'text-(--color-accent-700)')}
    >
      {children}
    </Link>
  );
}
