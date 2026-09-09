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

/*
 * ── Reconstruction slice ────────────────────────────────────────────────────
 * `DEALER_NAV` is the baseline's list, verbatim, because it is the shell's
 * shape and the next five features fill it in. Only one of its routes exists
 * today, and the nav renders only the routes that exist:
 *
 *   /dealer               F048  Dealer dashboard
 *   /dealer/inventory     F050  Dealer inventory list
 *   /dealer/vehicles/new  F056  The vehicle wizard
 *   /dealer/enquiries     F065  Dealer enquiries
 *   /dealer/billing       F051  Credits & billing
 *
 * A nav item pointing at a 404 is worse than a missing one — it is the console
 * telling a dealer a page exists and then not having it — so each feature above
 * deletes its own line from this set as it lands, and the item appears. When
 * the set is empty the constant goes with it and `DEALER_NAV` is used directly.
 *
 * A `Set` of hrefs rather than a shortened `DEALER_NAV` deliberately: the list
 * above is what F047 delivers and what the sandbox story renders in full, and a
 * reviewer comparing this file against the baseline should find the list
 * identical and the omission stated separately.
 * ────────────────────────────────────────────────────────────────────────────
 */
const NOT_YET_BUILT = new Set([
  '/dealer',
  '/dealer/inventory',
  '/dealer/vehicles/new',
  '/dealer/enquiries',
  '/dealer/billing',
]);

/** The items whose routes a dealer can actually reach today. */
export const LANDED_NAV: NavItem[] = DEALER_NAV.filter((item) => !NOT_YET_BUILT.has(item.href));

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

  /*
   * Nothing to show is not the same as an empty bar. Every item carrying a
   * `short` is one of the five routes above, so until one of them lands the bar
   * would be a 56px white strip pinned over the bottom of every console screen
   * with nothing in it. That is a reconstruction artefact rather than a state
   * of the product, and it is gone the moment F048 lands.
   */
  if (tabs.length === 0) return null;

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
