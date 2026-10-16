import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Alert, AppState } from 'react-native';
import { ApiError } from '../../../services/api';
import { useAuth, useSession } from '../../auth/auth-provider';
import { savedApi, hydrateSavedSlugs } from '../saved-api';
import { SAVED_TEXT } from '../saved.constants';
import { patchSavedMembership, removeSavedFromPages, restoreSavedRows, savedSlugsKey } from '../saved-cache';

interface SavedContextValue {
  isSaved: (slug: string) => boolean; isPending: (slug: string) => boolean;
  ready: boolean; updating: boolean; toggle: (slug: string) => void;
  save: (slug: string) => Promise<void>; resume: () => void;
  error: string | null; retry: () => void;
}
interface SaveOperation { id: number; wanted: boolean; optimistic: boolean; current: () => boolean }
interface SaveVariables { owner: string; slug: string; wanted: boolean; id: number }
const SavedContext = createContext<SavedContextValue | null>(null);
export function SavedProvider({ children }: { children: ReactNode }) {
  const { manager } = useAuth();
  const session = useSession();
  const router = useRouter();
  const cache = useQueryClient();
  const [pending, setPending] = useState<Set<string>>(new Set());
  const operations = useRef(new Map<string, SaveOperation>());
  const sequence = useRef(0);
  const userId = session.customer?.id;
  const query = useQuery({
    queryKey: ['customer', userId, 'saved-slugs'], enabled: session.status === 'authenticated',
    queryFn: ({ signal }) => {
      const token = manager.token();
      if (!token || manager.getSnapshot().customer?.id !== userId) throw new ApiError('AUTH_REQUIRED', 'Sign in to continue.', 401);
      return hydrateSavedSlugs(token, signal);
    }, staleTime: 30000,
    refetchOnWindowFocus: () => cache.isMutating({ mutationKey: ['customer', userId, 'saved-set'] }) === 0,
  });
  useEffect(() => {
    if (query.error instanceof ApiError && query.error.status === 401 && manager.getSnapshot().customer?.id === userId) void manager.invalidate();
  }, [query.error, manager, userId]);
  useEffect(() => {
    if (operations.current.size) { operations.current.clear(); setPending(new Set()); }
  }, [userId]);
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active' && session.status === 'authenticated' && cache.isMutating({ mutationKey: ['customer', userId, 'saved-set'] }) === 0) void cache.invalidateQueries({ queryKey: ['customer', userId, 'saved-slugs'] });
    });
    return () => sub.remove();
  }, [cache, userId, session.status]);
  const mutation = useMutation({
    mutationKey: ['customer', userId, 'saved-set'], retry: false, gcTime: 0,
    mutationFn: async (variables: SaveVariables) => {
      const operation = operations.current.get(`${variables.owner}:${variables.slug}`);
      const token = manager.token();
      if (!operation?.current() || operation.id !== variables.id || !token) throw new ApiError('REQUEST_CANCELLED', 'This saved action was cancelled.');
      const result = await savedApi.set(token, variables.slug, variables.wanted);
      if (result.slug !== variables.slug) throw new ApiError('INVALID_RESPONSE', 'The saved response could not be confirmed.');
      return result;
    },
    onMutate: async (variables: SaveVariables) => {
      const operation = operations.current.get(`${variables.owner}:${variables.slug}`);
      if (!operation || operation.id !== variables.id || !operation.current()) return;
      await cache.cancelQueries({ queryKey: savedSlugsKey(variables.owner) });
      await cache.cancelQueries({ queryKey: ['customer', variables.owner, 'saved-list'] });
      if (!operation.current()) return;
      const previous = cache.getQueryData<string[]>(savedSlugsKey(variables.owner));
      const wasSaved = previous?.includes(variables.slug);
      patchSavedMembership(cache, variables.owner, variables.slug, variables.wanted);
      const removed = variables.wanted ? [] : removeSavedFromPages(cache, variables.owner, variables.slug);
      return { current: operation.current, wasSaved, removed };
    },
    onError: (_error, variables, snapshot) => {
      if (!snapshot?.current()) return;
      const operation = operations.current.get(`${variables.owner}:${variables.slug}`);
      if (operation) operation.optimistic = false;
      setPending(new Set(operations.current.keys()));
      if (snapshot.wasSaved !== undefined) patchSavedMembership(cache, variables.owner, variables.slug, snapshot.wasSaved);
      restoreSavedRows(cache, snapshot.removed);
    },
    onSuccess: (result, variables, snapshot) => {
      if (snapshot?.current()) {
        const operation = operations.current.get(`${variables.owner}:${variables.slug}`);
        if (operation) operation.wanted = result.saved;
        patchSavedMembership(cache, variables.owner, variables.slug, result.saved);
      }
    },
    onSettled: async (_result, _error, variables, snapshot) => {
      if (!snapshot?.current() || cache.isMutating({ mutationKey: ['customer', variables.owner, 'saved-set'] }) > 1) return;
      await Promise.all([
        cache.invalidateQueries({ queryKey: ['customer', variables.owner, 'saved-list'] }),
        cache.invalidateQueries({ queryKey: savedSlugsKey(variables.owner) }),
      ]);
    },
  });
  useEffect(() => { if (mutation.status !== 'idle') mutation.reset(); }, [userId]);
  const set = async (slug: string, wanted: boolean) => {
    const token = manager.token();
    const owner = manager.getSnapshot().customer?.id;
    if (!token || !owner) {
      if (owner) await manager.invalidate();
      manager.pending.request({ kind: 'save', slug });
      if (owner) manager.pending.bind(owner);
      router.navigate('/sign-in'); return;
    }
    const key = `${owner}:${slug}`;
    if (operations.current.get(key)?.current()) return;
    const operation: SaveOperation = { id: ++sequence.current, wanted, optimistic: true, current: () => manager.getSnapshot().customer?.id === owner && manager.token() === token };
    operations.current.set(key, operation); setPending(new Set(operations.current.keys()));
    try {
      await mutation.mutateAsync({ owner, slug, wanted, id: operation.id });
    } catch (error) {
      if (!operation.current()) return;
      if (error instanceof ApiError && error.status === 401) {
        await manager.invalidate(); manager.pending.request({ kind: 'save', slug }); manager.pending.bind(owner); router.navigate('/sign-in');
      } else if (error instanceof ApiError && ['AGREEMENT_REQUIRED', 'PRIVACY_ACKNOWLEDGMENT_REQUIRED'].includes(error.code)) {
        manager.pending.request({ kind: 'save', slug }); manager.pending.bind(owner); router.navigate('/agreements');
      } else if (!(error instanceof ApiError && error.code === 'REQUEST_CANCELLED')) Alert.alert(SAVED_TEXT.title, error instanceof Error ? error.message : SAVED_TEXT.retry);
    } finally {
      if (operations.current.get(key) === operation) { operations.current.delete(key); setPending(new Set(operations.current.keys())); }
    }
  };
  const resume = () => {
    const action = manager.pending.peek(); const owner = manager.getSnapshot().customer?.id;
    if (!owner || !action || action.intent.kind !== 'save') return;
    const intent = manager.pending.consume(action.id, owner);
    if (intent?.kind === 'save') void set(intent.slug, true);
  };
  useEffect(() => { if (session.status === 'authenticated') resume(); }, [session.status, userId]);
  const activeOperation = (slug: string) => {
    const key = `${userId}:${slug}`; const operation = operations.current.get(key);
    return pending.has(key) && operation?.current() ? operation : undefined;
  };
  const value: SavedContextValue = {
    isSaved: slug => { const operation = activeOperation(slug); return operation?.optimistic ? operation.wanted : (query.data?.includes(slug) ?? false); },
    isPending: slug => Boolean(activeOperation(slug)),
    ready: session.status === 'guest' || query.data !== undefined,
    updating: [...operations.current.values()].some(operation => operation.current()),
    toggle: slug => void set(slug, !query.data?.includes(slug)), save: slug => set(slug, true), resume,
    error: query.isError ? query.error.message : null, retry: () => void query.refetch(),
  };
  return <SavedContext.Provider value={value}>{children}</SavedContext.Provider>;
}
export function useSaved() { const value = useContext(SavedContext); if (!value) throw new Error('SavedProvider is required.'); return value; }
