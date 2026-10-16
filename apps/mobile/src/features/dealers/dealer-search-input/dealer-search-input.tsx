import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { AutocompleteField } from '../../../components/autocomplete-field';
import { dealersApi, type DirectoryParams } from '../dealers-api';
import { DEALERS_TEXT } from '../dealers.constants';

export function DealerSearchInput({
  params,
  value,
  onChange,
  onSubmit,
  onSelect,
}: {
  params: DirectoryParams;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onSelect: (slug: string) => void;
}) {
  const [focused, setFocused] = useState(false);
  const [debounced, setDebounced] = useState('');
  const normalized = value.trim().replace(/\s+/g, ' ');
  const cache = useQueryClient();
  const key = useMemo(
    () => ['public', 'dealer-suggestions', params.district, params.city, debounced],
    [params.district, params.city, debounced],
  );
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(normalized), 350);
    return () => clearTimeout(timer);
  }, [normalized]);
  useEffect(
    () => () => {
      void cache.cancelQueries({ queryKey: key, exact: true });
    },
    [cache, key, normalized, focused],
  );
  const current = debounced === normalized && Boolean(normalized);
  const query = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => dealersApi.suggest(params, debounced, signal),
    enabled: focused && current,
  });
  const items = current && query.data?.search === normalized ? query.data.data : [];
  return (
    <AutocompleteField
      label={DEALERS_TEXT.search}
      placeholder={DEALERS_TEXT.searchPlaceholder}
      value={value}
      onChange={onChange}
      focused={focused}
      onFocusChange={setFocused}
      options={items.map((item) => ({
        key: item.slug,
        label: item.brandName,
        description: item.metaLabel,
      }))}
      pending={!current || query.isPending}
      error={current && query.isError ? 'Dealer suggestions could not load.' : undefined}
      retry={() => void query.refetch()}
      onSubmit={onSubmit}
      onSelect={(slug) => {
        if (items.some((item) => item.slug === slug)) onSelect(slug);
      }}
    />
  );
}
