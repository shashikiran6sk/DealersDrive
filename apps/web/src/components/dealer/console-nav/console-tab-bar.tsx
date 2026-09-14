'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/cn';
import { isCurrentPath } from '@/lib/nav';
import type { NavItem } from '@/types';

import { DEALER_NAV_LABEL, DEALER_ROOT_HREF, FULL_BAR } from './console-nav.constants';

export function ConsoleTabBar({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const tabs = items.filter((item) => item.short !== undefined);

  const overflow = tabs.length < FULL_BAR ? items.filter((item) => item.short === undefined) : [];
  const bar = [...tabs, ...overflow].slice(0, FULL_BAR);

  if (bar.length === 0) return null;

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-20 flex h-[56px] border-t border-(--color-divider) bg-white md:hidden"
      aria-label={DEALER_NAV_LABEL}
    >
      {bar.map((item) => {
        const current = isCurrentPath(pathname, item.href, DEALER_ROOT_HREF);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={current ? 'true' : undefined}
            className={cn(
              'flex flex-1 items-center justify-center px-1 text-center text-[12px]',
              current ? 'text-(--color-accent)' : 'ink-muted',
            )}
          >
            {item.short ?? item.label}
          </Link>
        );
      })}
    </nav>
  );
}
