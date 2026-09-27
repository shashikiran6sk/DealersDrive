'use client';

import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

import { SEARCH_NAVIGATION_TEXT } from './search-navigation.constants';
import { useSearchNavigation } from './search-navigation';

export function SearchResultsRegion({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const { pending } = useSearchNavigation();

  return (
    <div
      aria-busy={pending}
      className={cn('min-w-0 transition-opacity duration-150', pending && 'opacity-50', className)}
    >
      {pending ? (
        <p className="sr-only" role="status">
          {SEARCH_NAVIGATION_TEXT.updating}
        </p>
      ) : null}
      {children}
    </div>
  );
}
