import Link from 'next/link';

import { FOOTER_TEXT } from './customer-footer.constants';
import type { FooterLink } from './customer-footer.types';

export function PopularSearchesRow({ links }: { links: readonly FooterLink[] }) {
  if (links.length === 0) return null;
  return (
    <div className="border-t border-(--color-rule)">
      <nav
        aria-label={FOOTER_TEXT.popularColumn}
        className="mx-auto flex max-w-[1440px] flex-col gap-[10px] px-4 py-6 sm:px-6 lg:px-10"
      >
        <h2 className="text-[12px] font-extrabold uppercase tracking-[0.08em] ink-muted">
          {FOOTER_TEXT.popularColumn}
        </h2>
        <ul className="flex flex-wrap gap-x-5 gap-y-[7px]">
          {links.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="text-[13px] ink-secondary hover:text-(--color-ink) hover:underline"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
