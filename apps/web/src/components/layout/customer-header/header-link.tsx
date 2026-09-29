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
      className={cn(
        'transition-colors hover:text-(--color-ink)',
        active ? 'text-(--color-ink) underline decoration-2 underline-offset-[10px]' : 'ink-muted',
      )}
    >
      {children}
    </Link>
  );
}
