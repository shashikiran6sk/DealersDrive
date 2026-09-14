'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { isCurrentPath } from '@/lib/nav';
import type { NavItem } from '@/types';

import { DEALER_NAV_LABEL, DEALER_ROOT_HREF } from './console-nav.constants';

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
