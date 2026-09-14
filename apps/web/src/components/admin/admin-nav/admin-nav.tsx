'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/cn';
import { isCurrentPath } from '@/lib/nav';

import { ADMIN_NAV_LABEL, ADMIN_ROOT_HREF, LANDED_ADMIN_NAV } from './admin-nav.constants';
import type { AdminNavItem } from './admin-nav.types';

export function AdminNav({ items = LANDED_ADMIN_NAV }: { items?: AdminNavItem[] }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-[2px]" aria-label={ADMIN_NAV_LABEL}>
      {items.map((item) => {
        const current = isCurrentPath(pathname, item.href, ADMIN_ROOT_HREF);

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={current ? 'true' : undefined}
            className={cn(
              'block px-[10px] py-[6px] text-[13px] no-underline',
              current ? 'bg-white/15 text-white' : 'text-white/70 hover:bg-white/10',
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
