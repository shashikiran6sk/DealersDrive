import type { HTMLAttributes } from 'react';

import { cn } from '@/lib/cn';

import { Corners } from './corners';

export type BlueprintElement = 'div' | 'section' | 'article';

export type BlueprintProps = HTMLAttributes<HTMLElement> & { as?: BlueprintElement };

/**
 * The blueprint frame. All four registration marks, always — a `.blueprint`
 * missing a corner is the one thing DESIGN-SPEC §4.4 calls out by name.
 *
 * Reserved for: the hero search block, hero and gallery figures, body-type
 * tiles, stat and balance cards, the price block, review-summary panels, the
 * under-review panel, and empty states. Not for plain content cards.
 */
export function Blueprint({ className, children, as: Tag = 'div', ...props }: BlueprintProps) {
  return (
    <Tag className={cn('blueprint', className)} {...props}>
      <Corners />
      {children}
    </Tag>
  );
}
