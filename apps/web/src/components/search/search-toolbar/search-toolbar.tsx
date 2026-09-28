'use client';

import { cn } from '@/lib/cn';

import { SEARCH_TOOLBAR_TEXT } from './search-toolbar.constants';
import type { SearchToolbarProps } from './search-toolbar.types';
import { SearchField } from './search-field';
import { SortSelect } from './sort-select';

export function SearchToolbar({
  params,
  basePath,
  showSearch = true,
  searchPlaceholder,
  idPrefix = 'results',
  leading,
  className,
}: SearchToolbarProps) {
  return (
    <div
      role="group"
      aria-label={SEARCH_TOOLBAR_TEXT.groupLabel}
      className={cn('flex w-full flex-wrap items-center gap-2 sm:ml-auto sm:w-auto', className)}
    >
      {showSearch ? (
        <div className="w-full sm:w-auto">
          <SearchField
            key={basePath}
            params={params}
            basePath={basePath}
            id={`${idPrefix}-search`}
            {...(searchPlaceholder ? { placeholder: searchPlaceholder } : {})}
          />
        </div>
      ) : null}
      <div className="flex w-full items-center gap-2 sm:w-auto">
        {leading}
        <div className="min-w-0 flex-1 sm:flex-none">
          <SortSelect params={params} basePath={basePath} id={`${idPrefix}-sort`} />
        </div>
      </div>
    </div>
  );
}
