import { QueryClient } from '@tanstack/react-query';
import { clearCustomerCache } from '../src/features/auth/private-customer-cache';

it('removes every private query and mutation projection on logout while retaining public inventory', async () => {
  const cache = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
  const publicKey = ['public', 'cars'];
  cache.setQueryData(publicKey, ['public inventory']);
  for (const kind of [
    'saved-slugs',
    'saved-list',
    'enquiries',
    'support-tickets',
    'sharing-permissions',
    'legal-history',
  ])
    cache.setQueryData(['customer', 'previous', kind], ['private data']);
  let cancelled = false;
  const pending = cache
    .fetchQuery({
      queryKey: ['customer', 'previous', 'support-ticket', 'one'],
      queryFn: ({ signal }) =>
        new Promise<string>(() => {
          signal.addEventListener('abort', () => {
            cancelled = true;
          });
        }),
    })
    .catch(() => undefined);
  const mutations = cache.getMutationCache();
  mutations.build(cache, { mutationKey: ['customer', 'previous', 'saved-set'], gcTime: Infinity });
  const publicMutation = mutations.build(cache, {
    mutationKey: ['public', 'diagnostic'],
    gcTime: Infinity,
  });
  clearCustomerCache(cache);
  await pending;
  expect(cancelled).toBe(true);
  expect(cache.getQueriesData({ queryKey: ['customer'] })).toEqual([]);
  expect(cache.getQueryData(publicKey)).toEqual(['public inventory']);
  expect(mutations.getAll()).toEqual([publicMutation]);
  cache.clear();
});
