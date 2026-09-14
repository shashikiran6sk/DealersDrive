'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/cn';
import { isCurrentPath } from '@/lib/nav';
import type { NavItem } from '@/types';

import { DEALER_NAV_LABEL, DEALER_ROOT_HREF, FULL_BAR } from './console-nav.constants';

/** The 56px bottom tab bar, below 768 (§3.11). */
export function ConsoleTabBar({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const tabs = items.filter((item) => item.short !== undefined);

  /*
   * ── Reconstruction accommodation (F048) ─────────────────────────────────
   * §3.11's rule — "the bar is the five items carrying a `short`" — assumes all
   * five exist. Four are still F050, F051, F056 and F065, and applying the rule
   * literally today gives a phone one tab and no way to reach `/dealer/profile`
   * at all: the sidebar is `hidden md:flex`, so the bar is the only navigation a
   * narrow viewport has. So while the bar is short of its five, the items
   * without a `short` keep a place in it; when it is full this branch yields
   * nothing and the bar is exactly §3.11's.
   * ────────────────────────────────────────────────────────────────────────
   */
  const overflow = tabs.length < FULL_BAR ? items.filter((item) => item.short === undefined) : [];
  const bar = [...tabs, ...overflow].slice(0, FULL_BAR);

  /*
   * Nothing to show is not the same as an empty bar: a 56px white strip pinned
   * over every console screen with nothing in it is a reconstruction artefact
   * rather than a state of the product. The guard stays because `items` is a
   * prop and an empty one is a thing a caller can pass.
   */
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
