import { cn } from '@/lib/cn';

import { CollapsibleSearches } from './collapsible-searches';
import { RelatedSearchGroups } from './related-search-groups';
import type { RelatedSearchesProps } from './related-searches.types';

export function RelatedSearches({
  heading,
  groups,
  className,
  collapsible = false,
}: RelatedSearchesProps) {
  const shown = groups.filter((group) => group.links.length > 0);
  if (shown.length === 0) return null;

  if (collapsible) {
    return (
      <CollapsibleSearches heading={heading} groups={shown} {...(className ? { className } : {})} />
    );
  }

  return (
    <section aria-label={heading} className={cn('flex flex-col gap-5', className)}>
      <h2 className="text-[20px] leading-[1.2]">{heading}</h2>
      <RelatedSearchGroups groups={shown} />
    </section>
  );
}
