'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/cn';

/**
 * DESIGN-SPEC §3.17 — the admin nav, on the cobalt-900 field.
 *
 * The console's own `.dd-nav-item` colours are tuned for the white dealer
 * sidebar, so the admin variant is styled here rather than by overriding a
 * shared class in six places.
 */
export interface AdminNavItem {
  href: string;
  label: string;
}

export const ADMIN_NAV: AdminNavItem[] = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/listings', label: 'Listings' },
  { href: '/admin/dealers', label: 'Dealers' },
  { href: '/admin/payments', label: 'Payments' },
  { href: '/admin/config', label: 'Configuration' },
];

/*
 * ── Reconstruction slice (F048) ─────────────────────────────────────────────
 * `ADMIN_NAV` above is the baseline's list, verbatim, because it is the shell's
 * shape. Two of its five routes do not exist:
 *
 *   /admin/listings   F069  The moderation queue
 *   /admin/payments   F053  Payments and credit grants
 *
 * They were offered anyway from F049 until now, so two of the five items in a
 * cross-tenant operations console led to a 404. That is the mistake
 * `console-nav.tsx` was written to avoid on the dealer side, and the same
 * treatment applies here: **each feature above deletes its own line from this
 * set**, and its item appears. When the set is empty the constant goes with it
 * and `ADMIN_NAV` is rendered directly.
 *
 * A `Set` of hrefs rather than a shortened list, for the same reason as the
 * dealer console: a reviewer comparing this file against the baseline should
 * find the list identical and the omission stated separately.
 *
 * `/admin` itself comes off the set with this feature — the dashboard it points
 * at is what F048 lands.
 * ────────────────────────────────────────────────────────────────────────────
 */
const NOT_YET_BUILT = new Set(['/admin/listings', '/admin/payments']);

/** The items whose routes an operator can actually reach today. */
export const LANDED_ADMIN_NAV: AdminNavItem[] = ADMIN_NAV.filter(
  (item) => !NOT_YET_BUILT.has(item.href),
);

/**
 * `items` defaults to the landed set, so the shell renders the honest nav
 * without having to know about the slice — and the sandbox can still be handed
 * `ADMIN_NAV` to draw the console as it will be. The same shape as
 * `ConsoleNav`, which takes its items outright.
 */
export function AdminNav({ items = LANDED_ADMIN_NAV }: { items?: AdminNavItem[] }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-[2px]" aria-label="Admin console">
      {items.map((item) => {
        const current =
          item.href === '/admin' ? pathname === '/admin' : pathname.startsWith(item.href);

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
