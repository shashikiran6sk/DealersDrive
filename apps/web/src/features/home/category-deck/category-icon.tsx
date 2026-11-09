import { cn } from '@/lib/cn';

import { CategoryGlyph } from './category-glyph';
import type { CategoryIconProps } from './category-deck.types';

export function CategoryIcon({ icon, className }: CategoryIconProps) {
  return (
    <svg
      viewBox="0 0 64 32"
      aria-hidden="true"
      focusable="false"
      className={cn('h-[26px] w-[52px] text-(--color-ink)', className)}
    >
      <CategoryGlyph icon={icon} />
    </svg>
  );
}
