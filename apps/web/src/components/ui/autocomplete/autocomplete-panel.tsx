'use client';

import { useEffect, useRef, type ReactNode } from 'react';

import { cn } from '@/lib/cn';

import { AUTOCOMPLETE_TEXT } from './autocomplete.constants';
import type { UseAutocomplete } from './autocomplete.types';
import { SearchIcon } from './search-icon';

export interface AutocompletePanelProps<T> {
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
}

/**
 * The shell every typeahead draws: the bordered input row, and the panel under
 * it (DESIGN-SPEC §3.5).
 *
 * It renders the four states a remote list actually has — loading, error,
 * nothing found, and rows — because each is a different sentence and collapsing
 * any two of them lies to somebody. The rows themselves are the caller's, so a
 * dealer row and a vehicle row can look entirely different while the panel, the
 * states and the keyboard stay one implementation.
 */
export function AutocompletePanel<T>({
  autocomplete,
  label,
  placeholder,
  groupLabel,
  emptyMessage,
  className,
  children,
}: AutocompletePanelProps<T>) {
  const shell = useRef<HTMLDivElement>(null);
  const { open, status, items, countLabel, close } = autocomplete;

  /*
   * A click anywhere else closes the panel. `pointerdown` rather than `click` so
   * the panel is gone before the thing underneath reacts, and on the document
   * rather than via a blur handler because focus never leaves the input.
   */
  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      const target = event.target instanceof Node ? event.target : null;
      if (!shell.current?.contains(target)) close();
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open, close]);

  const showPanel = open && status !== 'idle';
  const inputId = `${autocomplete.listProps.id}-input`;

  return (
    <div ref={shell} className={cn('relative', className)}>
      <label className="sr-only" htmlFor={inputId}>
        {label}
      </label>

      <div className="input flex h-[38px] items-center gap-[6px] px-[8px] py-0 focus-within:border-(--color-accent) focus-within:outline focus-within:outline-2 focus-within:outline-(--color-accent)">
        <SearchIcon />
        <input
          id={inputId}
          type="text"
          placeholder={placeholder}
          className="h-[36px] min-w-0 flex-1 border-none bg-transparent text-[13.5px] caret-(--color-accent) outline-none placeholder:ink-subtle"
          {...autocomplete.inputProps}
        />
        {autocomplete.value.length > 0 ? (
          <button
            type="button"
            // A convenience for a pointer; Escape plus select-all is the
            // keyboard's way to the same place.
            onClick={autocomplete.clear}
            className="flex h-[24px] w-[24px] shrink-0 cursor-pointer items-center justify-center rounded-[2px] text-[12px] ink-subtle hover:bg-(--color-surface) hover:ink-body"
            aria-label={AUTOCOMPLETE_TEXT.clearLabel}
          >
            {AUTOCOMPLETE_TEXT.clearGlyph}
          </button>
        ) : null}
        {open ? (
          <span
            className="hidden shrink-0 rounded-[3px] border border-(--color-divider) bg-(--color-neutral-100) px-[5px] py-px text-[10px] ink-subtle font-mono sm:inline-flex"
            aria-hidden="true"
          >
            {AUTOCOMPLETE_TEXT.escapeHint}
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
              One row, saying which of the three non-list states this is. It still
              carries the listbox role: a screen reader that was told the box
              controls a list should not find that the list has vanished.
            */
            <div {...autocomplete.listProps} className="px-[12px] py-[14px] text-[13px]">
              {status === 'loading' ? (
                <span className="ink-subtle">{AUTOCOMPLETE_TEXT.loading}</span>
              ) : status === 'error' ? (
                <span className="ink-secondary">{AUTOCOMPLETE_TEXT.error}</span>
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
