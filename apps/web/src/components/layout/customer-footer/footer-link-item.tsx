import Link from 'next/link';

import type { FooterLink } from './customer-footer.types';

export function FooterLinkItem({ href, label }: FooterLink) {
  return (
    <li>
      <Link href={href} className="text-[13px] font-bold text-(--color-ink) hover:underline">
        {label}
      </Link>
    </li>
  );
}
