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
const ADMIN_NAV = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/listings', label: 'Listings' },
  { href: '/admin/dealers', label: 'Dealers' },
  { href: '/admin/payments', label: 'Payments' },
  { href: '/admin/config', label: 'Configuration' },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-[2px]" aria-label="Admin console">
      {ADMIN_NAV.map((item) => {
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
