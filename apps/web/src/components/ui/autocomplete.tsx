'use client';

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';

import { cn } from '@/lib/cn';
import { useDebouncedValue } from '@/lib/use-debounced-value';

export interface SuggestPayload<T> {
  search: string;
  data: T[];
  countLabel: string;
}

export interface AutocompleteSource<T> {
  suggest: (search: string, signal: AbortSignal) => Promise<SuggestPayload<T>>;
  keyOf: (item: T) => string;
  valueOf: (item: T) => string;
}

export type AutocompleteStatus = 'idle' | 'loading' | 'ready' | 'error';

export const SUGGEST_DEBOUNCE_MS = 300;

export const SUGGEST_MIN_CHARS = 1;

interface Result<T> {
  status: AutocompleteStatus;
  items: T[];
  countLabel: string;
  search: string;
}

const EMPTY: Result<never> = { status: 'idle', items: [], countLabel: '', search: '' };

export interface UseAutocomplete<T> {
  value: string;
  setValue: (next: string) => void;
  clear: () => void;
  open: boolean;
  close: () => void;
  status: AutocompleteStatus;
  items: T[];
  countLabel: string;
  search: string;
  highlighted: number;
  setHighlighted: (index: number) => void;
  choose: (item: T) => void;
  inputProps: {
    value: string;
    role: 'combobox';
    autoComplete: 'off';
    spellCheck: false;
    'aria-autocomplete': 'list';
    'aria-expanded': boolean;
    'aria-controls': string;
    'aria-activedescendant': string | undefined;
    onChange: (event: { target: { value: string } }) => void;
    onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
    onFocus: () => void;
  };
  listProps: { id: string; role: 'listbox' };
  optionProps: (
    item: T,
    index: number,
  ) => {
    id: string;
    role: 'option';
    'aria-selected': boolean;
    onMouseEnter: () => void;
    onMouseDown: (event: { preventDefault: () => void }) => void;
    onClick: () => void;
  };
}

export function useAutocomplete<T>({
  source,
  initialValue = '',
  onSelect,
  onClear,
}: {
  source: AutocompleteSource<T>;
  initialValue?: string;
  onSelect: (item: T) => void;
  onClear?: () => void;
}): UseAutocomplete<T> {
  const listId = useId();
  const [value, setValue] = useState(initialValue);
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const [result, setResult] = useState<Result<T>>(EMPTY as Result<T>);

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

export function HighlightedText({ text, match }: { text: string; match: string }): ReactNode {
  const needle = match.trim();
  if (needle.length === 0) return text;

  const parts: ReactNode[] = [];
  const haystack = text.toLowerCase();
  const lowered = needle.toLowerCase();

  let cursor = 0;
  let at = haystack.indexOf(lowered);

  while (at !== -1) {
    if (at > cursor) parts.push(text.slice(cursor, at));
    parts.push(
      <mark
        key={at}
        className="bg-transparent font-bold text-(--color-accent) underline [text-underline-offset:2px]"
      >
        {text.slice(at, at + needle.length)}
      </mark>,
    );
    cursor = at + needle.length;
    at = haystack.indexOf(lowered, cursor);
  }

  if (cursor < text.length) parts.push(text.slice(cursor));
  return parts;
}

export function AutocompletePanel<T>({
  autocomplete,
  label,
  placeholder,
  groupLabel,
  emptyMessage,
  className,
  children,
}: {
  autocomplete: UseAutocomplete<T>;
  label: string;
  placeholder: string;
  groupLabel: string;
  emptyMessage: (search: string) => string;
  className?: string;
  children: (autocomplete: UseAutocomplete<T>) => ReactNode;
}) {
  const shell = useRef<HTMLDivElement>(null);
  const { open, status, items, countLabel, close } = autocomplete;

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!shell.current?.contains(event.target as Node)) close();
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open, close]);

  const showPanel = open && status !== 'idle';

  return (
    <div ref={shell} className={cn('relative', className)}>
      <label className="sr-only" htmlFor={`${autocomplete.listProps.id}-input`}>
        {label}
      </label>

      <div className="input flex h-[38px] items-center gap-[6px] px-[8px] py-0 focus-within:border-(--color-accent) focus-within:outline focus-within:outline-2 focus-within:outline-(--color-accent)">
        <SearchIcon />
        <input
          id={`${autocomplete.listProps.id}-input`}
          type="text"
          placeholder={placeholder}
          className="h-[36px] min-w-0 flex-1 border-none bg-transparent text-[13.5px] caret-(--color-accent) outline-none placeholder:ink-subtle"
          {...autocomplete.inputProps}
        />
        {autocomplete.value.length > 0 ? (
          <button
            type="button"
            onClick={autocomplete.clear}
            className="flex h-[24px] w-[24px] shrink-0 cursor-pointer items-center justify-center rounded-[2px] text-[12px] ink-subtle hover:bg-(--color-surface) hover:ink-body"
            aria-label="Clear the search"
          >
            ✕
          </button>
        ) : null}
        {open ? (
          <span
            className="hidden shrink-0 rounded-[3px] border border-(--color-divider) bg-(--color-neutral-100) px-[5px] py-px text-[10px] ink-subtle font-mono sm:inline-flex"
            aria-hidden="true"
          >
            ESC to close
          </span>
        ) : null}
      </div>

      {showPanel ? (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 border border-(--color-divider) bg-white shadow-[var(--shadow-lg)]">
          {status === 'ready' && items.length > 0 ? (
            <>
              <div className="flex items-center justify-between border-b border-(--color-divider) bg-(--color-neutral-100) px-[12px] pb-[5px] pt-[7px]">
                <span className="text-[9.5px] font-semibold uppercase tracking-[0.1em] ink-subtle">
                  {groupLabel}
                </span>
                <span className="text-[10.5px] ink-subtle tnum">{countLabel}</span>
              </div>
              <ul className="list-none" {...autocomplete.listProps}>
                {children(autocomplete)}
              </ul>
            </>
          ) : (
            <div {...autocomplete.listProps} className="px-[12px] py-[14px] text-[13px]">
              {status === 'loading' ? (
                <span className="ink-subtle">Searching…</span>
              ) : status === 'error' ? (
                <span className="ink-secondary">
                  Suggestions are unavailable just now. Your search still works.
                </span>
              ) : (
                <span className="ink-secondary">{emptyMessage(autocomplete.search)}</span>
              )}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function SearchIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0 ink-subtle"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}
