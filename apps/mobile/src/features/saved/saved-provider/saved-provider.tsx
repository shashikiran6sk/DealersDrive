import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Alert, AppState } from 'react-native';
import { ApiError } from '../../../services/api';
import { useAuth, useSession } from '../../auth/auth-provider';
import { savedApi, hydrateSavedSlugs } from '../saved-api';
import { SAVED_TEXT } from '../saved.constants';

interface SavedContextValue {
  isSaved: (slug: string) => boolean;
  isPending: (slug: string) => boolean;
  ready: boolean;
  toggle: (slug: string) => void;
  save: (slug: string) => Promise<void>;
  resume: () => void;
  error: string | null;
  retry: () => void;
}
const SavedContext = createContext<SavedContextValue | null>(null);
export function SavedProvider({ children }: { children: ReactNode }) {
  const { manager } = useAuth();
  const session = useSession();
  const router = useRouter();
  const cache = useQueryClient();
  const [pending, setPending] = useState<Set<string>>(new Set());
  const locks = useRef(new Set<string>());
  const userId = session.customer?.id;
  const query = useQuery({
    queryKey: ['customer', userId, 'saved-slugs'],
    enabled: session.status === 'authenticated',
    queryFn: ({ signal }) => {
      const token = manager.token();
      if (!token) throw new ApiError('AUTH_REQUIRED', 'Sign in to continue.', 401);
      return hydrateSavedSlugs(token, signal);
    },
    staleTime: 30000,
  });
  useEffect(() => {
    if (
      query.error instanceof ApiError &&
      query.error.status === 401 &&
      manager.getSnapshot().customer?.id === userId
    )
      void manager.invalidate();
  }, [query.error, manager, userId]);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active')
        void cache.invalidateQueries({ queryKey: ['customer', userId, 'saved-slugs'] });
    });
    return () => sub.remove();
  }, [cache, userId]);
  const set = async (slug: string, wanted: boolean) => {
    const token = manager.token();
    const owner = manager.getSnapshot().customer?.id;
    if (!token || !owner) {
      if (owner) await manager.invalidate();
      manager.pending.request({ kind: 'save', slug });
      if (owner) manager.pending.bind(owner);
      router.navigate('/sign-in');
      return;
    }
    const key = `${owner}:${slug}`;
    if (locks.current.has(key)) return;
    locks.current.add(key);
    setPending(new Set(locks.current));
    try {
      const result = await savedApi.set(token, slug, wanted);
      if (manager.getSnapshot().customer?.id !== owner || manager.token() !== token) return;
      await cache.cancelQueries({ queryKey: ['customer', owner, 'saved-slugs'] });
      await cache.cancelQueries({ queryKey: ['customer', owner, 'saved-list'] });
      if (manager.getSnapshot().customer?.id !== owner || manager.token() !== token) return;
      cache.setQueryData<string[]>(['customer', owner, 'saved-slugs'], (previous) => {
        if (!previous) return previous;
        const next = new Set(previous);
        if (result.saved) next.add(result.slug);
        else next.delete(result.slug);
        return [...next];
      });
      await cache.invalidateQueries({ queryKey: ['customer', owner, 'saved-list'] });
      await cache.fetchQuery({
        queryKey: ['customer', owner, 'saved-slugs'],
        queryFn: ({ signal }) => hydrateSavedSlugs(token, signal),
        staleTime: 0,
      });
    } catch (error) {
      if (manager.getSnapshot().customer?.id !== owner || manager.token() !== token) return;
      if (error instanceof ApiError && error.status === 401) {
        await manager.invalidate();
        manager.pending.request({ kind: 'save', slug });
        manager.pending.bind(owner);
        router.navigate('/sign-in');
      } else if (
        error instanceof ApiError &&
        ['AGREEMENT_REQUIRED', 'PRIVACY_ACKNOWLEDGMENT_REQUIRED'].includes(error.code)
      ) {
        manager.pending.request({ kind: 'save', slug });
        manager.pending.bind(owner);
        router.navigate('/agreements');
      } else
        Alert.alert(SAVED_TEXT.title, error instanceof Error ? error.message : SAVED_TEXT.retry);
    } finally {
      locks.current.delete(key);
      setPending(new Set(locks.current));
    }
  };
  const resume = () => {
    const action = manager.pending.peek();
    const owner = manager.getSnapshot().customer?.id;
    if (!owner || !action || action.intent.kind !== 'save') return;
    const intent = manager.pending.consume(action.id, owner);
    if (intent?.kind === 'save') void set(intent.slug, true);
  };
  useEffect(() => {
    if (session.status === 'authenticated') resume();
  }, [session.status, userId]);
  const value: SavedContextValue = {
    isSaved: (slug) => query.data?.includes(slug) ?? false,
    isPending: (slug) => pending.has(`${userId}:${slug}`),
    ready: session.status === 'guest' || query.isSuccess,
    toggle: (slug) => void set(slug, !query.data?.includes(slug)),
    save: (slug) => set(slug, true),
    resume,
    error: query.isError ? query.error.message : null,
    retry: () => void query.refetch(),
  };
  return <SavedContext.Provider value={value}>{children}</SavedContext.Provider>;
}
export function useSaved() {
  const value = useContext(SavedContext);
  if (!value) throw new Error('SavedProvider is required.');
  return value;
}
