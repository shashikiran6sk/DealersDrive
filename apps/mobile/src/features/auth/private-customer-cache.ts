import type { QueryClient } from '@tanstack/react-query';

export function clearCustomerCache(client: QueryClient) {
  void client.cancelQueries({ predicate: (query) => query.queryKey[0] === 'customer' });
  client.removeQueries({ predicate: (query) => query.queryKey[0] === 'customer' });
  const mutations = client.getMutationCache();
  for (const mutation of mutations.getAll())
    if (mutation.options.mutationKey?.[0] === 'customer') mutations.remove(mutation);
}
