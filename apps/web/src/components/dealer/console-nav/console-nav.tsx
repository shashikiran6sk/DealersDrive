'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

import { LinkPendingIndicator } from '@/components/ui/link-pending';
import { isCurrentPath } from '@/lib/nav';
import { cn } from '@/lib/cn';
import type { NavItem } from '@/types';

import { DEALER_NAV_LABEL, DEALER_ROOT_HREF } from './console-nav.constants';

export function ConsoleNav({
  items,
  label = DEALER_NAV_LABEL,
  rootHref = DEALER_ROOT_HREF,
  footer,
}: {
  items: NavItem[];
  label?: string;
  rootHref?: string;
  footer?: ReactNode;
}) {
  const pathname = usePathname();

  return (
    <nav
      className={cn(
        'flex flex-col gap-[2px]',
        footer && 'min-h-0 flex-1 overflow-y-auto overscroll-contain',
      )}
      aria-label={label}
    >
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn('dd-nav-item', footer && 'shrink-0')}
          aria-current={isCurrentPath(pathname, item.href, rootHref) ? 'true' : undefined}
        >
          <span className="min-w-0 flex-1 truncate">{item.label}</span>
          <LinkPendingIndicator reserve />
        </Link>
      ))}
      {footer ? <div className="mt-auto shrink-0 pt-4">{footer}</div> : null}
    </nav>
  );
}
