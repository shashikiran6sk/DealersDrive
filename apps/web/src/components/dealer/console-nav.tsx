'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/cn';

/**
 * DESIGN-SPEC §3.11 — the console nav.
 *
 * A client component for one reason: `aria-current` has to follow the route.
 * Everything else in the shell stays server-rendered.
 *
 * Below 768 the sidebar becomes a 56px bottom tab bar of five items and the
 * credits card moves into Billing, so `Dealer profile` drops out of the bar.
 */
export interface NavItem {
  href: string;
  label: string;
  /** Shown in the bottom tab bar; items without one are desktop-only. */
  short?: string;
}

export const DEALER_NAV: NavItem[] = [
  { href: '/dealer', label: 'Dashboard', short: 'Home' },
  { href: '/dealer/inventory', label: 'Inventory', short: 'Stock' },
  { href: '/dealer/vehicles/new', label: 'Add vehicle', short: 'Add' },
  { href: '/dealer/enquiries', label: 'Enquiries', short: 'Leads' },
  { href: '/dealer/billing', label: 'Billing', short: 'Billing' },
  { href: '/dealer/profile', label: 'Dealer profile' },
];

function isCurrent(pathname: string, href: string): boolean {
  // `/dealer` must not light up for every page beneath it.
  return href === '/dealer' ? pathname === '/dealer' : pathname.startsWith(href);
}

export function ConsoleNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-[2px]" aria-label="Dealer console">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="dd-nav-item"
          aria-current={isCurrent(pathname, item.href) ? 'true' : undefined}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

/** The 56px bottom tab bar, below 768 (§3.11). */
export function ConsoleTabBar({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const tabs = items.filter((item) => item.short !== undefined);

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-20 flex h-[56px] border-t border-(--color-divider) bg-white md:hidden"
      aria-label="Dealer console"
    >
      {tabs.map((item) => {
        const current = isCurrent(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={current ? 'true' : undefined}
            className={cn(
              'flex flex-1 items-center justify-center text-[12px]',
              current ? 'text-(--color-accent)' : 'ink-muted',
            )}
          >
            {item.short}
          </Link>
        );
      })}
    </nav>
  );
}
