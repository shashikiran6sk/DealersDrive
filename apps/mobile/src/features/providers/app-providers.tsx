import { OverlayHost } from '../../components/overlay-host';
import { AppState } from 'react-native';
import { locationStore } from '../location/location';
import { SavedProvider } from '../saved/saved-provider';
import { AuthProvider } from '../auth/auth-provider';
import { focusManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';
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
  useEffect(() => {
    void locationStore.hydrate();
    focusManager.setFocused(AppState.currentState === 'active');
    const subscription = AppState.addEventListener('change', (state) =>
      focusManager.setFocused(state === 'active'),
    );
    return () => subscription.remove();
  }, []);
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <SavedProvider>
            <OverlayHost>{children}</OverlayHost>
          </SavedProvider>
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
