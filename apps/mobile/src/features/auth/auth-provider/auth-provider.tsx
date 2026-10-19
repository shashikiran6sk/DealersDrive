import { useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { AppState } from 'react-native';

import { createAuthApi, type AuthApi } from '../auth-api';
import { credentialStorage } from '../credential-storage';
import { SessionManager } from '../session-manager';
import { clearCustomerCache } from '../private-customer-cache';

const AuthContext = createContext<{ manager: SessionManager; api: AuthApi } | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [value] = useState(() => {
    const api = createAuthApi();
    const manager = new SessionManager(credentialStorage, api, () =>
      clearCustomerCache(queryClient),
    );
    return { api, manager };
  });
  useSyncExternalStore(
    value.manager.subscribe,
    value.manager.getSnapshot,
    value.manager.getSnapshot,
  );
  const manager = value.manager;
  const expiresAt = manager.expiresAt();
  useEffect(() => {
    if (!expiresAt) return;
    let timer: ReturnType<typeof setTimeout>;
    const check = () => {
      const remaining = Date.parse(expiresAt) - Date.now();
      if (remaining <= 0) {
        void manager.invalidate();
        return;
      }
      timer = setTimeout(check, Math.min(remaining, 2_147_483_647));
    };
    check();
    return () => clearTimeout(timer);
  }, [expiresAt, manager]);
  useEffect(() => {
    void value.manager.restore();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void value.manager.restore();
    });
    return () => subscription.remove();
  }, [value]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('AuthProvider is required.');
  return value;
}
export function useSession() {
  const { manager } = useAuth();
  const snapshot = useSyncExternalStore(
    manager.subscribe,
    manager.getSnapshot,
    manager.getSnapshot,
  );

  return snapshot;
}
