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

/**
 * The typeahead interaction, with nothing dealer-shaped in it (**R43**). A
 * caller supplies a `suggest` function and a row renderer; the hook owns the
 * three things that make a typeahead correct:
 *
 *   · **Debounce** — one request for "vellore" rather than eight.
 *   · **Abort** — the request a new query replaced is cancelled, on unmount too.
 *   · **The stale guard** — the one usually missing. Abort does not help once
 *     bytes are on the wire: a two-character query against a cold cache can
 *     resolve *after* the four-character query that replaced it. Every response
 *     carries the search it answered, and a mismatch is dropped.
 *
 * Accessibility is the ARIA 1.2 combobox pattern by hand — Radix has no
 * combobox. The input keeps focus throughout and `aria-activedescendant` moves
 * the screen reader's cursor, so a buyer can arrow the list while still typing.
 */
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

  /*
   * The value this box wrote into itself by choosing a row — otherwise choosing
   * "Vellore Cars" debounces into a request for the name just chosen and
   * reopens the dropdown over a page that is already navigating. A ref because
   * nothing renders from it and it must be true before the effect runs.
   */
  const chosen = useRef<string | null>(null);

  /*
   * `source` is almost always an object literal, so it is a new reference every
   * render and cannot go in the dependency list without refetching on each one.
   */
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

        // The stale guard: a reply to anything but the question currently being
        // asked is dropped rather than rendered.
        if (payload.search.trim() !== debounced) return;

        setResult({
          status: 'ready',
          items: payload.data,
          countLabel: payload.countLabel,
          search: payload.search,
        });
        // A fresh answer always highlights its first row: the whole promise of
        // this control is that Enter does the obvious thing without arrowing.
        setHighlighted(0);
        setOpen(true);
      } catch (error) {
        // An abort is this hook cancelling itself, not a failure. Showing
        // "something went wrong" because a buyer typed another character would
        // make fast typing look broken.
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
  // -1 rather than 0 when the list is empty, so `items[highlighted]` is
  // undefined rather than accidentally meaningful.
  const activeIndex = items.length === 0 ? -1 : Math.min(highlighted, items.length - 1);
  const activeItem = activeIndex >= 0 ? items[activeIndex] : undefined;

  const optionId = (item: T) => `${listId}-opt-${sourceRef.current.keyOf(item)}`;

  function move(delta: number): void {
    if (items.length === 0) return;
    // Wraps, as the UI reference does: past the last row is the first one.
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
        // Enter uses whatever is highlighted, which after every fresh answer is
        // the first row — so the common case is: type, pause, Enter.
        if (open && activeItem !== undefined) {
          event.preventDefault();
          choose(activeItem);
        }
        break;
      case 'Escape':
        // "Stop showing me this", not "undo what I wrote".
        if (open) {
          event.preventDefault();
          setOpen(false);
        }
        break;
      case 'Tab':
        // Leaving the box abandons the suggestion. Choosing on blur is the
        // behaviour that makes people distrust these controls.
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
      /*
       * The click has to survive the blur. `mousedown` fires first and would
       * take focus off the input, and a blur handler that closes the list would
       * unmount the row before `click` ever reached it.
       */
      onMouseDown: (event) => event.preventDefault(),
      onClick: () => choose(item),
    }),
  };
}
