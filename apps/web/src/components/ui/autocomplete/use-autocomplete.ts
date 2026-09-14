'use client';

import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';

import { useDebouncedValue } from '@/lib/use-debounced-value';

import { SUGGEST_DEBOUNCE_MS, SUGGEST_MIN_CHARS } from './autocomplete.constants';
import type {
  AutocompleteResult,
  UseAutocomplete,
  UseAutocompleteOptions,
} from './autocomplete.types';

const EMPTY: AutocompleteResult<never> = { status: 'idle', items: [], countLabel: '', search: '' };

export function useAutocomplete<T>({
  source,
  initialValue = '',
  onSelect,
  onClear,
}: UseAutocompleteOptions<T>): UseAutocomplete<T> {
  const listId = useId();
  const [value, setValue] = useState(initialValue);
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const [result, setResult] = useState<AutocompleteResult<T>>(EMPTY);

  const search = value.trim();
  const debounced = useDebouncedValue(search, SUGGEST_DEBOUNCE_MS);

  const chosen = useRef<string | null>(null);

  const sourceRef = useRef(source);
  sourceRef.current = source;

  useEffect(() => {
    if (chosen.current === debounced) return;
    chosen.current = null;

    if (debounced.length < SUGGEST_MIN_CHARS) {
      setResult(EMPTY);
      return;
    }

    const controller = new AbortController();
    setResult((current) => ({ ...current, status: 'loading' }));

    void (async () => {
      try {
        const payload = await sourceRef.current.suggest(debounced, controller.signal);

        if (payload.search.trim() !== debounced) return;

        setResult({
          status: 'ready',
          items: payload.data,
          countLabel: payload.countLabel,
          search: payload.search,
        });
        setHighlighted(0);
        setOpen(true);
      } catch (error) {
        if (controller.signal.aborted) return;
        if (error instanceof DOMException && error.name === 'AbortError') return;

        setResult({ status: 'error', items: [], countLabel: '', search: debounced });
        setOpen(true);
      }
    })();

    return () => controller.abort();
  }, [debounced]);

  const close = useCallback(() => setOpen(false), []);

  const choose = useCallback(
    (item: T) => {
      const next = sourceRef.current.valueOf(item);
      chosen.current = next.trim();
      setValue(next);
      setOpen(false);
      onSelect(item);
    },
    [onSelect],
  );

  const clear = useCallback(() => {
    chosen.current = '';
    setValue('');
    setResult(EMPTY);
    setOpen(false);
    onClear?.();
  }, [onClear]);

  const items = result.items;
  const activeIndex = items.length === 0 ? -1 : Math.min(highlighted, items.length - 1);
  const activeItem = activeIndex >= 0 ? items[activeIndex] : undefined;

  const optionId = (item: T) => `${listId}-opt-${sourceRef.current.keyOf(item)}`;

  function move(delta: number): void {
    if (items.length === 0) return;
    setHighlighted((current) => (current + delta + items.length) % items.length);
    setOpen(true);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        move(1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        move(-1);
        break;
      case 'Enter':
        if (open && activeItem !== undefined) {
          event.preventDefault();
          choose(activeItem);
        }
        break;
      case 'Escape':
        if (open) {
          event.preventDefault();
          setOpen(false);
        }
        break;
      case 'Tab':
        setOpen(false);
        break;
      default:
        break;
    }
  }

  return {
    value,
    setValue: (next: string) => {
      setValue(next);
      setHighlighted(0);
      if (next.trim().length >= SUGGEST_MIN_CHARS) setOpen(true);
      else setOpen(false);
    },
    clear,
    open: open && search.length >= SUGGEST_MIN_CHARS,
    close,
    status: result.status,
    items,
    countLabel: result.countLabel,
    search: result.search,
    highlighted: activeIndex,
    setHighlighted,
    choose,
    inputProps: {
      value,
      role: 'combobox',
      autoComplete: 'off',
      spellCheck: false,
      'aria-autocomplete': 'list',
      'aria-expanded': open && search.length >= SUGGEST_MIN_CHARS,
      'aria-controls': listId,
      'aria-activedescendant': activeItem === undefined ? undefined : optionId(activeItem),
      onChange: (event) => {
        const next = event.target.value;
        setValue(next);
        setHighlighted(0);
        setOpen(next.trim().length >= SUGGEST_MIN_CHARS);
      },
      onKeyDown,
      onFocus: () => {
        if (search.length >= SUGGEST_MIN_CHARS && result.items.length > 0) setOpen(true);
      },
    },
    listProps: { id: listId, role: 'listbox' },
    optionProps: (item, index) => ({
      id: optionId(item),
      role: 'option',
      'aria-selected': index === activeIndex,
      onMouseEnter: () => setHighlighted(index),
      onMouseDown: (event) => event.preventDefault(),
      onClick: () => choose(item),
    }),
  };
}
