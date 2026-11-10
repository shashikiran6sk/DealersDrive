import type { HomeCategoryView } from '../category-deck';

export interface CategoryShortcutsProps {
  categories: readonly Pick<HomeCategoryView, 'key' | 'href' | 'icon' | 'shortLabel'>[];
  className?: string;
}
