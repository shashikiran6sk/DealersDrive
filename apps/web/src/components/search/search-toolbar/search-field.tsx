'use client';

import { useEffect, useRef, useState } from 'react';

import { useSearchNavigation } from '@/components/search/search-navigation';
import { Input } from '@/components/ui/input';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { searchHref, setParam, type VehicleSearchParams } from '@/lib/vehicle-search';

import { SEARCH_DEBOUNCE_MS, SEARCH_TOOLBAR_TEXT } from './search-toolbar.constants';

export interface SearchFieldProps {
  params: VehicleSearchParams;
  basePath: string;
  id: string;
  placeholder?: string;
}

export function SearchField({
  params,
  basePath,
  id,
  placeholder = SEARCH_TOOLBAR_TEXT.searchPlaceholder,
}: SearchFieldProps) {
  const { navigate } = useSearchNavigation();
  const applied = params.q ?? '';
  const [text, setText] = useState(applied);
  const [seen, setSeen] = useState(applied);
  const requested = useRef(applied);

  if (applied !== seen) {
    setSeen(applied);
    setText(applied);
    requested.current = applied;
  }

  const settled = useDebouncedValue(text, SEARCH_DEBOUNCE_MS);

  function apply(value: string, mode: 'push' | 'replace'): void {
    const next = value.trim().replace(/\s+/g, ' ');
    if (next === requested.current.trim()) return;
    requested.current = next;
    navigate(searchHref(basePath, setParam(params, 'q', next || undefined)), { mode });
  }

  useEffect(() => {
    if (settled !== text) return;
    apply(settled, 'replace');
  });

  return (
    <form
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        apply(text, 'push');
      }}
    >
      <label className="sr-only" htmlFor={id}>
        {SEARCH_TOOLBAR_TEXT.searchLabel}
      </label>
      <Input
        id={id}
        type="search"
        autoComplete="off"
        enterKeyHint="search"
        className="w-full min-w-[200px] sm:w-[220px]"
        placeholder={placeholder}
        value={text}
        maxLength={120}
        onChange={(event) => {
          setText(event.target.value);
        }}
      />
    </form>
  );
}
