'use client';

import { canonicalVehicleMake } from '@dealers-drive/contracts';
import { useId, useState, type KeyboardEvent } from 'react';

import { cn } from '@/lib/cn';

import { VEHICLE_MAKE_TEXT } from './vehicle-make-select.constants';
import type { VehicleMakeSelectProps } from './vehicle-make-select.types';
import { matchMakes } from './utils';

export function VehicleMakeSelect({
  id,
  name = id,
  defaultValue = '',
  placeholder,
  required = false,
  disabled = false,
  ...aria
}: VehicleMakeSelectProps) {
  const initial = defaultValue.trim();
  const saved = initial && !canonicalVehicleMake(initial) ? initial : null;
  const [make, setMake] = useState(canonicalVehicleMake(initial) ?? initial);
  const [search, setSearch] = useState(make);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const listId = useId();
  const matches = matchMakes(search === make ? '' : search, saved);

  function choose(value: string) {
    setMake(value);
    setSearch(value);
    setOpen(false);
  }

  function settle() {
    setOpen(false);
    const resolved = canonicalVehicleMake(search);
    if (resolved) choose(resolved);
    else setSearch(make);
  }

  function keydown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      setOpen(false);
      setSearch(make);
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((index) =>
        Math.max(0, Math.min(matches.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1))),
      );
    }
    if (event.key === 'Enter' && open) {
      event.preventDefault();
      const option = matches[activeIndex];
      if (option) choose(option);
    }
  }

  return (
    <div
      className="relative"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) settle();
      }}
    >
      <input
        id={id}
        type="search"
        role="combobox"
        className="input"
        autoComplete="off"
        value={search}
        disabled={disabled}
        placeholder={placeholder}
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={
          open && matches[activeIndex] ? `${listId}-${activeIndex}` : undefined
        }
        aria-required={required ? 'true' : undefined}
        {...aria}
        onFocus={(event) => {
          setOpen(true);
          setActiveIndex(0);
          event.currentTarget.select();
        }}
        onKeyDown={keydown}
        onChange={(event) => {
          setSearch(event.target.value);
          setOpen(true);
          setActiveIndex(0);
        }}
      />
      <input type="hidden" name={name} value={make} disabled={disabled} />
      {open ? (
        <ul
          id={listId}
          role="listbox"
          aria-label={VEHICLE_MAKE_TEXT.listLabel}
          className="absolute z-20 mt-1 max-h-[240px] w-full overflow-y-auto rounded-lg border border-(--color-divider) bg-white shadow-lg"
        >
          {matches.map((item, index) => (
            <li
              key={item}
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
                )}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(item)}
              >
                {item === saved ? VEHICLE_MAKE_TEXT.savedOutsideList(item) : item}
              </button>
            </li>
          ))}
          {matches.length === 0 ? (
            <li className="px-3 py-3 text-[13px]">{VEHICLE_MAKE_TEXT.noMatch}</li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}
