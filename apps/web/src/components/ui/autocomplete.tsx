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

/**
 * The typeahead, with nothing dealer-shaped in it (**R43**).
 *
 * ── Why this is generic ─────────────────────────────────────────────────────
 * The directory is the first box to get suggestions and it will not be the
 * last: the catalogue's make/model search lands at **F077**, and it wants every
 * behaviour below — the 300 ms hold, the abort, the stale-answer guard, the
 * first row highlighted, the arrow keys, the `role="combobox"` wiring — and
 * exactly none of the dealer-specific parts.
 *
 * So this file owns the *interaction* and knows nothing about what is in the
 * list. A caller supplies a `suggest` function and a row renderer;
 * `DealerSearchBox` is the first, and a `VehicleSearchBox` is meant to be the
 * second without touching anything here. That is the D-6 lesson applied before
 * the duplicate exists rather than after: `.table` was hand-rolled five times
 * because the second author could not find the first one's work.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * ## The three things that make a typeahead correct
 *
 * **Debounce** — the request is not made until typing stops for 300 ms. It is
 * the difference between one request and eight for the word "vellore".
 *
 * **Abort** — when the query moves on, the request it replaced is cancelled.
 * The effect cleanup does it, so it happens on unmount too.
 *
 * **The stale guard** — and this is the one that is usually missing. Abort does
 * not help once bytes are on the wire: a two-character query against a cold
 * cache can resolve *after* the four-character query that replaced it, and the
 * dropdown then shows answers to something the buyer has already finished
 * typing past. So every response carries the search it answered, and an answer
 * that does not match what is currently being asked is dropped on the floor.
 *
 * ## Accessibility
 *
 * The ARIA 1.2 combobox pattern, by hand rather than through Radix, because
 * Radix has no combobox — `Dialog` is theirs and this is not one. The input
 * keeps focus throughout and `aria-activedescendant` moves the screen reader's
 * cursor, which is what lets a buyer arrow through the list while still typing
 * into the box. Every row is a real element with `role="option"` and an id, so
 * the relationship is in the DOM rather than in a handler.
 */

/** What a suggest endpoint answers with. One shape for every typeahead. */
export interface SuggestPayload<T> {
  /**
   * The search this payload answers.
   *
   * **Load-bearing** — see the stale guard above. A source that does not echo
   * it back cannot be made correct on the client.
   */
  search: string;
  data: T[];
  countLabel: string;
}

/** Everything the interaction needs to know about the rows it is moving through. */
export interface AutocompleteSource<T> {
  /**
   * Fetch suggestions for `search`. Must honour `signal`, and must echo the
   * search back in the payload.
   */
  suggest: (search: string, signal: AbortSignal) => Promise<SuggestPayload<T>>;
  /** A stable React key, and the suffix of the option's DOM id. */
  keyOf: (item: T) => string;
  /** What the input should read once this row is chosen. */
  valueOf: (item: T) => string;
}

/** Where the dropdown is in its lifecycle. Rendered, not inferred from truthiness. */
export type AutocompleteStatus = 'idle' | 'loading' | 'ready' | 'error';

/**
 * How long to wait for typing to stop.
 *
 * 300 ms is the usual answer and it is the right one: below about 150 ms the
 * saving disappears on anything but a hunt-and-peck typist, and past about 400
 * the list visibly lags the caret. It is a constant rather than a prop because
 * a box that felt different from the box on the next page would be a worse
 * product than either setting.
 */
export const SUGGEST_DEBOUNCE_MS = 300;

/**
 * The shortest input worth asking about.
 *
 * One character. It is a low bar deliberately — "MG" is a marque and several
 * dealerships trade under two letters — and the endpoint is shaped to answer
 * cheaply enough that the first keystroke is not special.
 */
export const SUGGEST_MIN_CHARS = 1;

interface Result<T> {
  status: AutocompleteStatus;
  items: T[];
  countLabel: string;
  /** The search these items answer — what the highlighter marks. */
  search: string;
}

const EMPTY: Result<never> = { status: 'idle', items: [], countLabel: '', search: '' };

export interface UseAutocomplete<T> {
  value: string;
  setValue: (next: string) => void;
  /** Clears the box and closes the list, without choosing anything. */
  clear: () => void;
  open: boolean;
  close: () => void;
  status: AutocompleteStatus;
  items: T[];
  countLabel: string;
  /** The characters the rows matched — pass to `HighlightedText`. */
  search: string;
  /** Index into `items`. Always 0 after a fresh answer; -1 when there are none. */
  highlighted: number;
  setHighlighted: (index: number) => void;
  /** Chooses a row: fills the input, closes the list, calls `onSelect`. */
  choose: (item: T) => void;
  /** Spread onto the `<input>`. Carries the combobox ARIA and the key handling. */
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
  /** Spread onto the listbox element. */
  listProps: { id: string; role: 'listbox' };
  /** Spread onto each row. `index` is its position in `items`. */
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
  /** A row was chosen — by Enter, or by a click. */
  onSelect: (item: T) => void;
  /** The box was emptied. Separate from `onSelect` because it is the opposite. */
  onClear?: () => void;
}): UseAutocomplete<T> {
  const listId = useId();
  const [value, setValue] = useState(initialValue);
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const [result, setResult] = useState<Result<T>>(EMPTY as Result<T>);

  const search = value.trim();
  const debounced = useDebouncedValue(search, SUGGEST_DEBOUNCE_MS);

  /*
   * The value this box wrote into itself by choosing a row.
   *
   * Choosing "Vellore Cars" sets the input to "Vellore Cars", which is a change
   * to `value`, which would debounce into a request for the exact name that was
   * just chosen — and then reopen the dropdown over a page that is already
   * navigating. A ref rather than state because nothing renders from it, and
   * because it must be true *before* the effect below runs rather than after
   * the next paint.
   */
  const chosen = useRef<string | null>(null);

  /*
   * `source` is almost always an object literal, so it is a new reference every
   * render and cannot go in the dependency list without refetching on each one.
   * The effect wants the *current* source, and a ref is how you say that.
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

        /*
         * The stale guard. `payload.search` is what the server answered; a
         * reply to anything but the question currently being asked is dropped
         * rather than rendered. This is what `abort` cannot do — see the
         * docblock at the top.
         */
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
        // An abort is this component cancelling itself, not a failure. Showing
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
        /*
         * **Enter uses whatever is highlighted**, which after every fresh
         * answer is the first row — so the common case is: type, pause, Enter.
         * Nothing is "selected" in the sense of having been clicked, and that
         * is the point of the default highlight.
         *
         * `preventDefault` only when there is something to choose, so this stays
         * a normal key inside whatever form may one day wrap the box.
         */
        if (open && activeItem !== undefined) {
          event.preventDefault();
          choose(activeItem);
        }
        break;
      case 'Escape':
        // Closes the list and keeps what was typed — Escape is "stop showing me
        // this", not "undo what I wrote".
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
       * unmount the row before `click` ever reached it — the classic dropdown
       * bug where the first click does nothing.
       */
      onMouseDown: (event) => event.preventDefault(),
      onClick: () => choose(item),
    }),
  };
}

/**
 * The typed characters, marked inside a label (**R43**).
 *
 * Case-insensitive, and it marks **every** occurrence: "Vellore Star Auto" on
 * "a" should not underline one `a` and leave the others plain, which reads as a
 * rendering fault rather than a match.
 *
 * `<mark>` rather than a styled `<span>` because that is what the element is
 * for, and because a screen reader announces it. The styling is the design's —
 * accent, bold, underlined, no highlighter background (`DESIGN-SPEC` §3.5 and
 * the UI reference) — so it reads as emphasis rather than as a selection.
 *
 * When the text does not contain the search at all it renders unmarked, which
 * is the correct answer for a row matched on its town rather than its name.
 */
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

/**
 * The shell every typeahead draws: the bordered input row, and the panel under
 * it (`DESIGN-SPEC` §3.5, and the Search-Bar UI reference).
 *
 * It renders the four states a remote list actually has — loading, error,
 * nothing found, and rows — because each of them is a different sentence and
 * collapsing any two of them lies to somebody. "No dealerships match" shown
 * while the request is still in flight is the most common version of that lie.
 *
 * The rows themselves are the caller's: `children` receives the hook, so a
 * dealer row and a vehicle row can look entirely different while the panel,
 * the states and the keyboard stay one implementation.
 */
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
  /** The visually-hidden `<label>`. Never a placeholder standing in for one. */
  label: string;
  placeholder: string;
  /** The uppercase heading over the rows — "Dealerships in Vellore district". */
  groupLabel: string;
  /** What to say when the search matched nothing. Gets the search back. */
  emptyMessage: (search: string) => string;
  className?: string;
  children: (autocomplete: UseAutocomplete<T>) => ReactNode;
}) {
  const shell = useRef<HTMLDivElement>(null);
  const { open, status, items, countLabel, close } = autocomplete;

  /*
   * A click anywhere else closes the panel. `pointerdown` rather than `click`
   * so the panel is gone before the thing underneath reacts, and on the
   * document rather than via a blur handler because focus never leaves the
   * input — that is the combobox pattern, and a blur-based close would fire on
   * a scrollbar drag.
   */
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
            // Not a submit, and not in the tab order ahead of the list: it is a
            // convenience for a pointer, and Escape plus select-all is the
            // keyboard's way to the same place.
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
            /*
              One row, saying which of the three non-list states this is. It
              still carries the listbox role: a screen reader that was told the
              box controls a list should not find that the list has vanished.
            */
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
