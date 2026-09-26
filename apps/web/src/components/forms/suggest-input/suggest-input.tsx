'use client';

import { useEffect, useState } from 'react';

import { Input } from '@/components/ui/input';
import { useDebouncedValue } from '@/lib/use-debounced-value';

import { SUGGEST_DEBOUNCE_MS } from './suggest-input.constants';
import type { SuggestInputProps } from './suggest-input.types';
import { fetchSuggestions } from './utils';

export function SuggestInput({
  id,
  field,
  name = id,
  defaultValue = '',
  ...props
}: SuggestInputProps) {
  const [query, setQuery] = useState(defaultValue);
  const [values, setValues] = useState<string[]>([]);
  const settled = useDebouncedValue(query.trim(), SUGGEST_DEBOUNCE_MS);
  const listId = `${id}-suggestions`;

  useEffect(() => {
    if (!settled) return;
    const controller = new AbortController();
    fetchSuggestions(field, settled, controller.signal)
      .then(setValues)
      .catch(() => setValues([]));
    return () => controller.abort();
  }, [field, settled]);

  return (
    <>
      <Input
        id={id}
        name={name}
        list={listId}
        autoComplete="off"
        defaultValue={defaultValue}
        onChange={(event) => setQuery(event.currentTarget.value)}
        {...props}
      />
      <datalist id={listId}>
        {(settled ? values : []).map((value) => (
          <option key={value} value={value} />
        ))}
      </datalist>
    </>
  );
}
