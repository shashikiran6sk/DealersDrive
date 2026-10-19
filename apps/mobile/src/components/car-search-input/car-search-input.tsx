import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { CarSuggestion } from '@dealers-drive/contracts/public';
import type { VehicleSearchParams } from '@dealers-drive/contracts/vehicle-search';
import { useEffect, useMemo, useState } from 'react';
import { carsApi } from '../../features/cars/cars-api';
import { CARS_TEXT } from '../../features/cars/cars.constants';
import { AutocompleteField } from '../autocomplete-field';

export function CarSearchInput({
  params,
  value,
  onChange,
  onSelect,
}: {
  params: VehicleSearchParams;
  value: string;
  onChange: (value: string) => void;
  onSelect: (suggestion: CarSuggestion) => void;
}) {
  const [focused, setFocused] = useState(false);
  const normalized = value.trim().replace(/\s+/g, ' ');
  const [debounced, setDebounced] = useState('');
  const cache = useQueryClient();
  const key = useMemo(
    () => ['public', 'car-suggestions', params.district, params.city, params.dealer, debounced],
    [params.district, params.city, params.dealer, debounced],
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
  const current = normalized === debounced && Boolean(normalized);
  const query = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => carsApi.suggest(params, debounced, signal),
    enabled: focused && current,
  });
  const rows = current && query.data?.search === normalized ? query.data.data : [];
  return (
    <AutocompleteField
      label={CARS_TEXT.searchLabel}
      placeholder={CARS_TEXT.searchPlaceholder}
      value={value}
      onChange={onChange}
      focused={focused}
      onFocusChange={setFocused}
      pending={!current || query.isPending}
      error={query.isError && current ? CARS_TEXT.suggestionsUnavailable : undefined}
      retry={() => void query.refetch()}
      options={rows.map((item, index) => ({
        key: String(index),
        label: item.label,
        description: item.metaLabel,
      }))}
      onSelect={(key) => {
        const item = rows[Number(key)];
        if (item && current) onSelect(item);
      }}
    />
  );
}
