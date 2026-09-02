'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';

import { Field, invalidProps } from '@/components/forms/field';
import { cn } from '@/lib/cn';

/**
 * A type-to-filter select, for lists too long to scroll.
 *
 * The catalogue has 41 makes and 344 models; a `<select>` of 344 options is a
 * technically-working control that nobody can use. This keeps the semantics of
 * one — a single value, chosen from a closed list, submitted as a hidden input
 * so it participates in the surrounding `<form>` exactly as a `<select>` would
 * — and replaces only the finding.
 *
 * Deliberately hand-rolled rather than pulled in: it is a listbox and a text
 * input, ARCHITECTURE forbids adding a state library for it, and Radix has no
 * combobox primitive. The accessibility contract it implements is the WAI-ARIA
 * combobox pattern — `role="combobox"` with `aria-expanded`, `aria-controls`
 * and `aria-activedescendant`, arrow/enter/escape keys, and a live count — and
 * that contract is the reason not to improvise a div with a click handler.
 */
export interface ComboboxOption {
  value: string;
  label: string;
  /** Second line, e.g. "Petrol · Manual · 1197cc". */
  hint?: string;
  /** Matched against the query in addition to `label`. */
  keywords?: string;
}

export function Combobox({
  id,
  label,
  name,
  options,
  value,
  onChange,
  placeholder,
  emptyLabel = 'No matches.',
  disabled = false,
  disabledLabel,
  required = false,
  error,
  hint,
}: {
  id: string;
  label: string;
  /** Submitted with the form, like a `<select name>`. */
  name?: string;
  options: ComboboxOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  emptyLabel?: string;
  disabled?: boolean;
  /** Shown in place of the value when disabled, e.g. "Choose a make first". */
  disabledLabel?: string;
  required?: boolean;
  error?: string;
  hint?: string;
}) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selected = useMemo(
    () => options.find((option) => option.value === value) ?? null,
    [options, value],
  );

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (needle === '') return options;
    // Prefix matches first: typing "cre" should offer Creta before Discovery,
    // which also contains "cre".
    const scored = options
      .map((option) => {
        const haystack = `${option.label} ${option.keywords ?? ''}`.toLowerCase();
        const index = haystack.indexOf(needle);
        if (index < 0) return null;
        return { option, score: option.label.toLowerCase().startsWith(needle) ? 0 : index + 1 };
      })
      .filter((entry): entry is { option: ComboboxOption; score: number } => entry !== null);

    scored.sort((a, b) => a.score - b.score);
    return scored.map((entry) => entry.option);
  }, [options, query]);

  // A narrowed list can be shorter than the previously active index.
  useEffect(() => setActive(0), [query, options]);

  // Closing on an outside click is what makes this behave like a control
  // rather than a panel that has to be dismissed deliberately.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) close();
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  function close() {
    setOpen(false);
    setQuery('');
  }

  function commit(option: ComboboxOption) {
    onChange(option.value);
    close();
    inputRef.current?.focus();
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      const delta = event.key === 'ArrowDown' ? 1 : -1;
      setActive((current) => {
        if (matches.length === 0) return 0;
        return (current + delta + matches.length) % matches.length;
      });
      return;
    }
    if (event.key === 'Enter' && open) {
      const option = matches[active];
      if (option) {
        event.preventDefault();
        commit(option);
      }
      return;
    }
    if (event.key === 'Escape' && open) {
      event.preventDefault();
      close();
      return;
    }
    if (event.key === 'Tab') close();
  }

  const display = open ? query : (selected?.label ?? '');
  const effectivePlaceholder = disabled
    ? (disabledLabel ?? 'Not available yet')
    : (selected?.label ?? placeholder ?? 'Search…');

  return (
    <Field id={id} label={label} error={error} hint={hint}>
      <div ref={rootRef} className="relative">
        <input
          ref={inputRef}
          id={id}
          type="text"
          role="combobox"
          autoComplete="off"
          className={cn('input w-full', disabled && 'cursor-not-allowed opacity-60')}
          disabled={disabled}
          value={display}
          placeholder={effectivePlaceholder}
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-required={required || undefined}
          aria-activedescendant={open && matches[active] ? `${listId}-${active}` : undefined}
          {...invalidProps(id, error)}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onKeyDown={onKeyDown}
        />

        {/* The actual form value. Keeping it separate from the text input is
            what stops a half-typed query from ever being submitted as a
            selection — only `commit` writes here. */}
        {name ? <input type="hidden" name={name} value={value} /> : null}

        {open && !disabled ? (
          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            aria-label={label}
            className="absolute z-20 mt-1 max-h-[280px] w-full overflow-y-auto border border-(--color-divider) bg-white shadow-lg"
          >
            {matches.length === 0 ? (
              <li className="px-3 py-2 text-[13px] ink-muted">{emptyLabel}</li>
            ) : (
              matches.map((option, index) => (
                <li
                  key={option.value}
                  id={`${listId}-${index}`}
                  role="option"
                  aria-selected={option.value === value}
                  data-active={index === active}
                  className={cn(
                    'cursor-pointer px-3 py-2 text-[13px]',
                    index === active && 'bg-(--color-accent-100)',
                    option.value === value && 'font-medium',
                  )}
                  onMouseEnter={() => setActive(index)}
                  // `pointerdown` rather than `click`: the input's blur would
                  // otherwise close the list before the click landed.
                  onPointerDown={(event) => {
                    event.preventDefault();
                    commit(option);
                  }}
                >
                  <div>{option.label}</div>
                  {option.hint ? <div className="text-[11px] ink-subtle">{option.hint}</div> : null}
                </li>
              ))
            )}
          </ul>
        ) : null}
      </div>

      {/* Screen readers get the result count; sighted users can see the list. */}
      <span aria-live="polite" className="sr-only">
        {open ? `${matches.length} ${matches.length === 1 ? 'result' : 'results'}` : ''}
      </span>
    </Field>
  );
}
