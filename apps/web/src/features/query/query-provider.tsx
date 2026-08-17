'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';

/**
 * TanStack Query, for dashboard state only (ARCHITECTURE §15.2).
 *
 * Public pages use RSC `fetch` and the Next cache; this exists for the console,
 * where data is per-session, mutable and has no SEO value — the enquiry inbox's
 * tab switching, and anything else that must refetch without a navigation.
 *
 * The client is created in state rather than at module scope so a server render
 * cannot leak one user's cache into another's.
 */
export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Console data is small and cheap; a short stale window keeps tab
            // switching instant without showing yesterday's inbox.
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
