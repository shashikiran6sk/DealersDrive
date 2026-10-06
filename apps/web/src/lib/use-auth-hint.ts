'use client';

import { useSyncExternalStore } from 'react';

import {
  AUTH_HINT_COOKIE,
  AUTH_HINT_MAX_AGE_SECONDS,
  AUTH_HINT_VALUE,
  authHintFrom,
  type AuthHint,
} from './auth-hint';

const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function snapshot(): AuthHint {
  return authHintFrom(document.cookie);
}

function serverSnapshot(): AuthHint {
  return 'unknown';
}

export function announceAuthHint(): void {
  const hint = snapshot();
  document.documentElement.setAttribute('data-auth', hint);
  for (const listener of listeners) listener();
}

export function useAuthHint(): AuthHint {
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot);
}

export function rememberAuthHint(signedIn: boolean): void {
  const value = signedIn ? AUTH_HINT_VALUE.signedIn : AUTH_HINT_VALUE.signedOut;
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${AUTH_HINT_COOKIE}=${value}; Path=/; Max-Age=${String(AUTH_HINT_MAX_AGE_SECONDS)}; SameSite=Lax${secure}`;
  announceAuthHint();
}

export function forgetAuthHint(): void {
  document.cookie = `${AUTH_HINT_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
  announceAuthHint();
}
