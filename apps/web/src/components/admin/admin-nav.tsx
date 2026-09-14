'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/cn';

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

const NOT_YET_BUILT = new Set(['/admin/listings', '/admin/payments']);

export const LANDED_ADMIN_NAV: AdminNavItem[] = ADMIN_NAV.filter(
  (item) => !NOT_YET_BUILT.has(item.href),
);

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
