'use client';

import { usePathname, useRouter } from 'next/navigation';
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react';

import {
  SavedVehiclesContext,
  type SavedVehiclesContextValue,
} from '@/components/vehicle/save-button';
import { savedSlugsAction, setSavedAction } from '@/features/saved/actions';
import { useAuthHint } from '@/lib/use-auth-hint';

import { SaveFromUrl } from './save-from-url';
import { SAVED_PATH, saveLoginHref } from './saved.constants';
import type { SavedSetter, SavedSlugsLoader, SavedSlugsState } from './saved.types';

export interface SavedVehiclesProviderProps {
  children: ReactNode;
  loadSlugs?: SavedSlugsLoader;
  setSaved?: SavedSetter;
}

type SlugSet = ReadonlySet<string>;

function toggleIn(set: Dispatch<SetStateAction<SlugSet>>, slug: string, on: boolean): void {
  set((current) => {
    if (current.has(slug) === on) return current;
    const next = new Set(current);
    if (on) next.add(slug);
    else next.delete(slug);
    return next;
  });
}

export function SavedVehiclesProvider({
  children,
  loadSlugs = savedSlugsAction,
  setSaved = setSavedAction,
}: SavedVehiclesProviderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [account, setAccount] = useState<SavedSlugsState['status']>('unknown');
  const [slugs, setSlugs] = useState<SlugSet>(new Set());
  const [pending, setPending] = useState<SlugSet>(new Set());
  const [message, setMessage] = useState('');
  const saved = useRef<SlugSet>(slugs);
  const loaded = useRef(false);
  const request = useRef<{ live: boolean } | null>(null);
  const hint = useAuthHint();
  saved.current = slugs;

  const signIn = useCallback(
    (slug: string) => {
      router.push(saveLoginHref(pathname, window.location.search, slug));
    },
    [pathname, router],
  );

  const write = useCallback(
    async (slug: string, want: boolean) => {
      toggleIn(setPending, slug, true);
      toggleIn(setSlugs, slug, want);
      setMessage('');
      const result = await setSaved(slug, want);
      toggleIn(setPending, slug, false);

      if (result.status === 'ok') {
        toggleIn(setSlugs, slug, result.saved);
        setAccount('customer');
        if (pathname === SAVED_PATH) router.refresh();
        return;
      }
      toggleIn(setSlugs, slug, !want);
      if (result.status === 'signed-out') {
        setAccount('anonymous');
        signIn(slug);
        return;
      }
      setMessage(result.message);
    },
    [pathname, router, setSaved, signIn],
  );

  const saveFromIntent = useCallback(
    (slug: string) => {
      if (!saved.current.has(slug)) void write(slug, true);
    },
    [write],
  );

  useEffect(
    () => () => {
      if (request.current) request.current.live = false;
      request.current = null;
      loaded.current = false;
    },
    [],
  );

  useEffect(() => {
    if (hint === 'out') {
      if (request.current) request.current.live = false;
      request.current = null;
      loaded.current = false;
      setAccount('anonymous');
      setSlugs((current) => (current.size === 0 ? current : new Set()));
      return;
    }
    if (loaded.current) return;
    loaded.current = true;
    const ticket = { live: true };
    request.current = ticket;
    loadSlugs()
      .then((state) => {
        if (!ticket.live) return;
        setAccount(state.status);
        if (state.status === 'customer') setSlugs(new Set(state.slugs));
      })
      .catch(() => {
        if (ticket.live) loaded.current = false;
      });
  }, [hint, loadSlugs]);

  const value = useMemo<SavedVehiclesContextValue>(
    () => ({
      enabled: true,
      isSaved: (slug) => slugs.has(slug),
      isPending: (slug) => pending.has(slug),
      toggle: (slug) => {
        if (account === 'anonymous') {
          signIn(slug);
          return;
        }
        void write(slug, !slugs.has(slug));
      },
    }),
    [account, pending, signIn, slugs, write],
  );

  return (
    <SavedVehiclesContext.Provider value={value}>
      {children}
      <Suspense fallback={null}>
        <SaveFromUrl ready={account === 'customer'} onIntent={saveFromIntent} />
      </Suspense>
      <p role="status" aria-live="polite" className="sr-only">
        {message}
      </p>
    </SavedVehiclesContext.Provider>
  );
}
