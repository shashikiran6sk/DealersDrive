'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';

import { LinkPendingIndicator } from '@/components/ui/link-pending';
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
        'relative transition-colors hover:text-(--color-ink)',
        active ? 'text-(--color-ink) underline decoration-2 underline-offset-[10px]' : 'ink-muted',
      )}
    >
      {children}
      <LinkPendingIndicator className="absolute top-1/2 -right-[20px] size-[14px] -translate-y-1/2" />
    </Link>
  );
}
