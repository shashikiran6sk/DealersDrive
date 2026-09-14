import Link from 'next/link';

import type { FooterLink } from './customer-footer.types';

export function FooterLinkItem({ href, label }: FooterLink) {
  return (
    <li>
      <Link href={href} className="text-[13px] ink-secondary">
        {label}
      </Link>
    </li>
  );
}
