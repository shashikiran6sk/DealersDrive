'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { LinkPendingIndicator } from '@/components/ui/link-pending';
import { isCurrentPath } from '@/lib/nav';
import type { NavItem } from '@/types';

import { DEALER_NAV_LABEL, DEALER_ROOT_HREF } from './console-nav.constants';

export function ConsoleNav({
  items,
  label = DEALER_NAV_LABEL,
  rootHref = DEALER_ROOT_HREF,
}: {
  items: NavItem[];
  label?: string;
  rootHref?: string;
}) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-[2px]" aria-label={label}>
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="dd-nav-item"
          aria-current={isCurrentPath(pathname, item.href, rootHref) ? 'true' : undefined}
        >
          <span className="min-w-0 flex-1 truncate">{item.label}</span>
          <LinkPendingIndicator reserve />
        </Link>
      ))}
    </nav>
  );
}
