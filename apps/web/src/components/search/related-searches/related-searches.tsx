import Link from 'next/link';

import { LinkPendingLabel } from '@/components/ui/link-pending';
import { cn } from '@/lib/cn';

import type { RelatedSearchesProps } from './related-searches.types';

export function RelatedSearches({ heading, groups, className }: RelatedSearchesProps) {
  const shown = groups.filter((group) => group.links.length > 0);
  if (shown.length === 0) return null;

  return (
    <section aria-label={heading} className={cn('flex flex-col gap-5', className)}>
      <h2 className="text-[20px] leading-[1.2]">{heading}</h2>
      {shown.map((group) => (
        <div key={group.title} className="flex flex-col gap-[10px]">
          <h3 className="eyebrow">{group.title}</h3>
          <ul className="flex flex-wrap gap-2">
            {group.links.map((link) => (
              <li key={link.href} className="max-w-full">
                <Link href={link.href} className="relative dd-chip max-w-full whitespace-normal">
                  <LinkPendingLabel>{link.label}</LinkPendingLabel>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
