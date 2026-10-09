'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { LinkPendingIndicator } from '@/components/ui/link-pending';
import { cn } from '@/lib/cn';
import { isCurrentPath } from '@/lib/nav';
import type { NavItem } from '@/types';

import { DEALER_NAV_LABEL, DEALER_ROOT_HREF, FULL_BAR } from './console-nav.constants';

export function ConsoleTabBar({
  items,
  label = DEALER_NAV_LABEL,
  rootHref = DEALER_ROOT_HREF,
}: {
  items: NavItem[];
  label?: string;
  rootHref?: string;
}) {
  const pathname = usePathname();
  const tabs = items.filter((item) => item.short !== undefined);

  const overflow = tabs.length < FULL_BAR ? items.filter((item) => item.short === undefined) : [];
  const bar = [...tabs, ...overflow].slice(0, FULL_BAR);

  if (bar.length === 0) return null;

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-20 flex h-[calc(60px+env(safe-area-inset-bottom))] pb-[env(safe-area-inset-bottom)] border-t border-(--color-divider) bg-white/95 backdrop-blur-md md:hidden"
      aria-label={label}
    >
      {bar.map((item) => {
        const current = isCurrentPath(pathname, item.href, rootHref);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={current ? 'true' : undefined}
            className={cn(
              'relative flex flex-1 items-center justify-center px-1 text-center text-[12px]',
              current
                ? 'font-extrabold text-(--color-ink) shadow-[inset_0_2px_0_var(--color-ink)]'
                : 'font-semibold ink-muted',
            )}
          >
            {item.short ?? item.label}
            <LinkPendingIndicator className="absolute top-[6px] right-[6px] size-[14px]" />
          </Link>
        );
      })}
    </nav>
  );
}
