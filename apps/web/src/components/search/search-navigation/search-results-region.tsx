'use client';

import type { ReactNode } from 'react';

import { SEARCH_NAVIGATION_TEXT } from './search-navigation.constants';
import { useSearchNavigation } from './search-navigation';
import { resultsRegionClass } from './utils';

export function SearchResultsRegion({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const { pending } = useSearchNavigation();

  return (
    <div aria-busy={pending} className={resultsRegionClass(pending, className)}>
      {pending ? (
        <p className="sr-only" role="status">
          {SEARCH_NAVIGATION_TEXT.updating}
        </p>
      ) : null}
      {children}
    </div>
  );
}
