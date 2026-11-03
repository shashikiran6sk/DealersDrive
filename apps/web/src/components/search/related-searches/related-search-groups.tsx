import { cn } from '@/lib/cn';
import type { RelatedSearchGroup } from '@/types';

import { RelatedSearchChip } from './related-search-chip';

export function RelatedSearchGroups({
  groups,
  compact = false,
}: {
  groups: readonly RelatedSearchGroup[];
  compact?: boolean;
}) {
  return (
    <>
      {groups.map((group) => (
        <div key={group.title} className={compact ? 'contents' : 'flex flex-col gap-[10px]'}>
          <h3 className={cn('eyebrow', compact && 'sr-only')}>{group.title}</h3>
          <ul className={compact ? 'contents' : 'flex flex-wrap gap-2'}>
            {group.links.map((link) => (
              <RelatedSearchChip key={link.href} link={link} />
            ))}
          </ul>
        </div>
      ))}
    </>
  );
}
