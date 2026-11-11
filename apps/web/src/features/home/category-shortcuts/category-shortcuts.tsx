import Link from 'next/link';
import type { CSSProperties } from 'react';

import { LinkPendingLabel } from '@/components/ui/link-pending';
import { cn } from '@/lib/cn';

import { CategoryIcon } from '../category-deck';
import { SHORTCUTS_TEXT } from './category-shortcuts.constants';
import type { CategoryShortcutsProps } from './category-shortcuts.types';

export function CategoryShortcuts({ categories, className }: CategoryShortcutsProps) {
  if (categories.length === 0) return null;

  return (
    <nav aria-label={SHORTCUTS_TEXT.label} className={cn('max-w-[560px]', className)}>
      <ul className="grid grid-cols-5 gap-1.5 sm:gap-2">
        {categories.map((category, index) => {
          const style: CSSProperties & { '--rise-index': number } = { '--rise-index': index + 4 };
          return (
            <li key={category.key} className="dd-rise min-w-0" style={style}>
              <Link
                href={category.href}
                className="dd-tile relative flex h-full flex-col items-center justify-between gap-1.5 rounded-[14px] border border-(--color-divider) bg-white px-0.5 pt-3 pb-2.5 text-center text-[10.5px] leading-[1.25] font-bold ink-secondary transition-[border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-(--color-ink) active:scale-95 sm:text-[12px]"
              >
                <CategoryIcon
                  icon={category.icon}
                  className="h-[20px] w-[40px] sm:h-[26px] sm:w-[52px]"
                />
                <LinkPendingLabel>{category.shortLabel}</LinkPendingLabel>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
