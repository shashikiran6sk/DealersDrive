import Link from 'next/link';

import { LinkPendingLabel } from '@/components/ui/link-pending';
import type { RelatedSearchLink } from '@/types';

export function RelatedSearchChip({ link }: { link: RelatedSearchLink }) {
  return (
    <li className="max-w-full">
      <Link href={link.href} className="relative dd-chip max-w-full whitespace-normal">
        <LinkPendingLabel>{link.label}</LinkPendingLabel>
      </Link>
    </li>
  );
}
