'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { isCurrentPath } from '@/lib/nav';
import type { NavItem } from '@/types';

import { DEALER_NAV_LABEL, DEALER_ROOT_HREF } from './console-nav.constants';

/**
 * DESIGN-SPEC §3.11 — the console nav. A client component for one reason:
 * `aria-current` has to follow the route. Everything else in the shell stays
 * server-rendered.
 */
export function ConsoleNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-[2px]" aria-label={DEALER_NAV_LABEL}>
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="dd-nav-item"
          aria-current={isCurrentPath(pathname, item.href, DEALER_ROOT_HREF) ? 'true' : undefined}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
