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
  const hasWebsite = items.some((item) => item.href === '/dealer/website');
  const visibleBar = hasWebsite && items.length > FULL_BAR ? bar.slice(0, FULL_BAR - 1) : bar;
  const more = hasWebsite
    ? items.filter((item) => !visibleBar.some((shown) => shown.href === item.href))
    : [];

  if (bar.length === 0) return null;

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-20 flex h-[60px] border-t border-(--color-divider) bg-white/95 backdrop-blur-md md:hidden"
      aria-label={label}
    >
      {visibleBar.map((item) => {
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
      {more.length ? (
        <details className="relative flex-1">
          <summary className="flex h-full min-h-[60px] cursor-pointer items-center justify-center text-[12px] font-semibold">
            More
          </summary>
          <div className="absolute bottom-[64px] right-2 flex min-w-[190px] flex-col rounded-xl border border-(--color-divider) bg-white p-2 shadow-lg">
            {more.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex min-h-[44px] items-center rounded-lg px-3 text-[13px]"
                aria-current={isCurrentPath(pathname, item.href, rootHref) ? 'true' : undefined}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </details>
      ) : null}
    </nav>
  );
}
