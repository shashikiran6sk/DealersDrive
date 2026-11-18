'use client';

import { useEffect, useId, useState, type KeyboardEvent } from 'react';

import { cn } from '@/lib/cn';

import { VEHICLE_OPTION_TEXT, VEHICLE_SUGGESTIONS_PATH } from './vehicle-option-select.constants';
import type { VehicleOptionSelectProps, VehicleOptionStatus } from './vehicle-option-select.types';
import { fetchVehicleOptions, resolveVehicleOption, vehicleOptionRows } from './utils';

export function VehicleOptionSelect({
  id,
  field,
  make,
  model = '',
  source = VEHICLE_SUGGESTIONS_PATH.dealer,
  name = id,
  defaultValue = '',
  placeholder,
  maxLength,
  required = false,
  disabled = false,
  onValueChange,
  ...aria
}: VehicleOptionSelectProps) {
  const ready = make !== '' && (field === 'model' || model !== '');
  const [committed, setCommitted] = useState(defaultValue.trim());
  const [search, setSearch] = useState(committed);
  const [options, setOptions] = useState<string[]>([]);
  const [status, setStatus] = useState<VehicleOptionStatus>('idle');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const listId = useId();
  const rows = vehicleOptionRows(options, search, committed);
  const parent = field === 'model' ? make : `${make} ${model}`;

  useEffect(() => {
    if (!ready) return;
    const controller = new AbortController();
    setStatus('loading');
    fetchVehicleOptions(source, model ? { field, make, model } : { field, make }, controller.signal)
      .then((values) => {
        setOptions(values);
        setStatus('ready');
      })
      .catch(() => {
        if (!controller.signal.aborted) setStatus('failed');
      });
    return () => controller.abort();
  }, [field, make, model, ready, source]);

  function commit(value: string) {
    setCommitted(value);
    setSearch(value);
    setOpen(false);
    if (value !== committed) onValueChange?.(value);
  }

  function openList() {
    setOpen(true);
    const current = rows.findIndex((row) => row.kind === 'option' && row.value === committed);
    setActiveIndex(Math.max(0, current));
  }

  function keydown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      setOpen(false);
      setSearch(committed);
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) return openList();
      setActiveIndex((index) =>
        Math.max(0, Math.min(rows.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1))),
      );
    }
    if (event.key === 'Enter' && open) {
      event.preventDefault();
      const row = rows[activeIndex];
      commit(row ? row.value : resolveVehicleOption(search, options));
    }
  }

  const footer =
    status === 'loading'
      ? VEHICLE_OPTION_TEXT.loading
      : status === 'failed'
        ? VEHICLE_OPTION_TEXT.failed(field)
        : options.length === 0
          ? VEHICLE_OPTION_TEXT.noneYet(field, parent)
          : rows.some((row) => row.kind === 'new')
            ? null
            : VEHICLE_OPTION_TEXT.notListed(field);

  return (
    <div
      className="relative"
      onBlur={(event) => {
        if (event.currentTarget.contains(event.relatedTarget)) return;
        commit(resolveVehicleOption(search, options));
      }}
    >
      <input
        id={id}
        type="text"
        role="combobox"
        className="input"
        autoComplete="off"
        value={search}
        maxLength={maxLength}
        disabled={disabled || !ready}
        placeholder={ready ? placeholder : VEHICLE_OPTION_TEXT.needsParent[field]}
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && rows[activeIndex] ? `${listId}-${activeIndex}` : undefined}
        aria-required={required ? 'true' : undefined}
        {...aria}
        onFocus={(event) => {
          openList();
          event.currentTarget.select();
        }}
        onKeyDown={keydown}
        onChange={(event) => {
          setSearch(event.target.value);
          setOpen(true);
          setActiveIndex(0);
        }}
      />
      <input
        type="hidden"
        name={name}
        value={resolveVehicleOption(search, options)}
        disabled={disabled}
      />
      {open && ready ? (
        <ul
          id={listId}
          role="listbox"
          aria-label={VEHICLE_OPTION_TEXT.listLabel[field]}
          className="absolute z-20 mt-1 max-h-[260px] w-full overflow-y-auto rounded-lg border border-(--color-divider) bg-white shadow-lg"
        >
          {rows.map((row, index) => (
            <li
              key={`${row.kind}:${row.value}`}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === activeIndex}
            >
              <button
                type="button"
                tabIndex={-1}
                className={cn(
                  'w-full px-3 py-3 text-left text-[14px] hover:bg-(--color-bg-muted) focus:bg-(--color-bg-muted)',
                  index === activeIndex && 'bg-(--color-bg-muted)',
                  row.kind === 'new' && 'border-t border-(--color-divider) font-semibold',
                )}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => commit(row.value)}
              >
                {row.kind === 'new' ? VEHICLE_OPTION_TEXT.addNew(field, row.value) : row.value}
              </button>
            </li>
          ))}
          {footer ? (
            <li
              role="presentation"
              className="border-t border-(--color-divider) px-3 py-3 text-[13px] text-(--color-neutral-600)"
            >
              {footer}
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}
