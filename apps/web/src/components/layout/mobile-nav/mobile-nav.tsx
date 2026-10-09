'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Dialog } from '@/components/ui/dialog';
import { LinkPendingIndicator } from '@/components/ui/link-pending';
import { isCurrentPath } from '@/lib/nav';

import { MOBILE_NAV_TEXT } from './mobile-nav.constants';
import type { MobileNavProps } from './mobile-nav.types';

export function MobileNav({
  items,
  label,
  rootHref,
  heading,
  navigation,
  children,
}: MobileNavProps) {
  const pathname = usePathname();
  const [openPath, setOpenPath] = useState<string | null>(null);
  const open = openPath === pathname;

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const desktop = window.matchMedia('(min-width: 768px)');
    const closeOnDesktop = () => {
      if (desktop.matches) setOpenPath(null);
    };
    desktop.addEventListener('change', closeOnDesktop);
    return () => desktop.removeEventListener('change', closeOnDesktop);
  }, []);

  return (
    <Dialog
      variant="drawer"
      open={open}
      onOpenChange={(next) => setOpenPath(next ? pathname : null)}
      title={label}
      closeLabel={MOBILE_NAV_TEXT.close}
      trigger={
        <button
          type="button"
          className="btn btn-secondary grid size-11 flex-none place-items-center p-0 md:hidden"
          aria-label={MOBILE_NAV_TEXT.open(label)}
          aria-expanded={open}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M4 6h16M4 12h16M4 18h16"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </button>
      }
    >
      {heading ? <div className="mb-4 flex flex-col items-start gap-2">{heading}</div> : null}
      {navigation ? (
        <div
          onClickCapture={(event) => {
            if (event.target instanceof Element && event.target.closest('a[href]')) {
              setOpenPath(null);
            }
          }}
        >
          {navigation}
        </div>
      ) : (
        <nav aria-label={label} className="flex flex-col gap-1">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="dd-nav-item min-h-12"
              aria-current={isCurrentPath(pathname, item.href, rootHref) ? 'page' : undefined}
              onClick={() => setOpenPath(null)}
            >
              <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">{item.label}</span>
              <LinkPendingIndicator reserve />
            </Link>
          ))}
        </nav>
      )}
      {children ? (
        <div className="mt-5 border-t border-(--color-divider) pt-4">{children}</div>
      ) : null}
    </Dialog>
  );
}
