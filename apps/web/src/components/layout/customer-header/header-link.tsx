'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

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
