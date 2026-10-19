'use client';

import { useRouter } from 'next/navigation';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useTransition,
  type ReactNode,
} from 'react';

import { revealAnchor } from './utils';

export type NavigationMode = 'push' | 'replace';

export interface NavigateOptions {
  mode?: NavigationMode;
  optimistic?: () => void;
}

export interface SearchNavigation {
  pending: boolean;
  navigate: (href: string, options?: NavigateOptions) => void;
}

const SearchNavigationContext = createContext<SearchNavigation | null>(null);

export function SearchNavigationProvider({
  children,
  anchor,
}: {
  children: ReactNode;
  anchor?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !pending && anchor) revealAnchor(anchor);
    wasPending.current = pending;
  }, [pending, anchor]);

  const value = useMemo<SearchNavigation>(
    () => ({
      pending,
      navigate: (href, { mode = 'push', optimistic } = {}) => {
        startTransition(() => {
          optimistic?.();
          if (mode === 'replace') router.replace(href, { scroll: false });
          else router.push(href, { scroll: false });
        });
      },
    }),
    [pending, router],
  );

  return (
    <SearchNavigationContext.Provider value={value}>{children}</SearchNavigationContext.Provider>
  );
}

export function useSearchNavigation(): SearchNavigation {
  const context = useContext(SearchNavigationContext);
  const router = useRouter();
  return (
    context ?? {
      pending: false,
      navigate: (href, { mode = 'push' } = {}) => {
        if (mode === 'replace') router.replace(href, { scroll: false });
        else router.push(href, { scroll: false });
      },
    }
  );
}
