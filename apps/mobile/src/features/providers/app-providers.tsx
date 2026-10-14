import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ApiError } from '../../services/api';

export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60000,
            retry: (count, error) =>
              count < 1 &&
              error instanceof ApiError &&
              (error.code === 'NETWORK_UNAVAILABLE' ||
                error.code === 'REQUEST_TIMEOUT' ||
                (error.status !== null && error.status >= 500)),
          },
          mutations: { retry: false },
        },
      }),
  );
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </SafeAreaProvider>
  );
}
