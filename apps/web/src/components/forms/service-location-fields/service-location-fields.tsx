'use client';

import type { ServiceStateDto } from '@dealers-drive/contracts';
import { useEffect, useId, useState, type KeyboardEvent } from 'react';
import { loadServiceLocationsAction } from '@/features/service-location-actions';
import { cn } from '@/lib/cn';
import { Field, invalidProps } from '@/components/forms/field';

import { SERVICE_LOCATION_TEXT } from './service-location-fields.constants';
import { matchDistricts } from './utils';

interface Props {
  initialState: string;
  initialDistrict: string;
  prefix?: string;
  errors?: Record<string, string | undefined>;
  disabled?: boolean;
  onChange?: (field: 'state' | 'district', value: string) => void;
}

export function ServiceLocationFields({
  initialState,
  initialDistrict,
  prefix = '',
  errors = {},
  disabled = false,
  onChange,
}: Props) {
  const [states, setStates] = useState<ServiceStateDto[]>([]);
  const [state, setState] = useState(initialState);
  const [district, setDistrict] = useState(initialDistrict);
  const [search, setSearch] = useState(initialDistrict);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [failure, setFailure] = useState(false);
  const [loading, setLoading] = useState(true);
  const listId = useId();
  useEffect(() => {
    setState(initialState);
  }, [initialState]);
  useEffect(() => {
    setDistrict(initialDistrict);
    setSearch(initialDistrict);
  }, [initialDistrict]);
  useEffect(() => {
    let alive = true;
    void loadServiceLocationsAction()
      .then((result) => {
        if (alive) {
          setStates(result.data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (alive) {
          setFailure(true);
          setLoading(false);
        }
      });
    return () => {
      alive = false;
    };
  }, []);
  const selectedState = states.find((item) => item.name === state);
  const districts = selectedState?.districts ?? [];
  const matches = matchDistricts(districts, search);
  function choose(value: string) {
    setDistrict(value);
    setSearch(value);
    setOpen(false);
    onChange?.('district', value);
  }
  function keydown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      setOpen(false);
      setSearch(district);
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
      if (option) choose(option.name);
    }
  }
  const blocked = disabled || loading || failure;
  return (
    <>
      <Field id={`${prefix}state`} label={SERVICE_LOCATION_TEXT.stateLabel} error={errors.state}>
        <select
          id={`${prefix}state`}
          name="state"
          className="input"
          value={state}
          disabled={blocked}
          required
          aria-required="true"
          {...invalidProps(`${prefix}state`, errors.state)}
          onChange={(event) => {
            const value = event.target.value;
            setState(value);
            choose('');
            onChange?.('state', value);
          }}
        >
          <option value="">
            {loading ? SERVICE_LOCATION_TEXT.loadingStates : SERVICE_LOCATION_TEXT.selectState}
          </option>
          {state && !selectedState ? (
            <option value={state}>{SERVICE_LOCATION_TEXT.existingState(state)}</option>
          ) : null}
          {states.map((item) => (
            <option key={item.id} value={item.name}>
              {item.name}
            </option>
          ))}
        </select>
      </Field>
      <Field
        id={`${prefix}district`}
        label={SERVICE_LOCATION_TEXT.districtLabel}
        error={errors.district}
      >
        <div
          className="relative"
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) {
              setOpen(false);
              setSearch(district);
            }
          }}
        >
          <input
            id={`${prefix}district`}
            type="search"
            role="combobox"
            className="input"
            autoComplete="off"
            value={search}
            disabled={blocked || !selectedState}
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={
              open && matches[activeIndex] ? `${listId}-${activeIndex}` : undefined
            }
            aria-required="true"
            placeholder={SERVICE_LOCATION_TEXT.searchDistricts}
            {...invalidProps(`${prefix}district`, errors.district)}
            onFocus={(event) => {
              setOpen(true);
              setActiveIndex(0);
              event.currentTarget.select();
            }}
            onKeyDown={keydown}
            onChange={(event) => {
              setSearch(event.target.value);
              setDistrict('');
              setOpen(true);
              setActiveIndex(0);
              onChange?.('district', '');
            }}
          />
          <input type="hidden" name="district" value={district} disabled={disabled} />
          {open ? (
            <ul
              id={listId}
              role="listbox"
              aria-label={SERVICE_LOCATION_TEXT.districtsListLabel}
              className="absolute z-20 mt-1 max-h-[240px] w-full overflow-y-auto rounded-lg border border-(--color-divider) bg-white shadow-lg"
            >
              {matches.map((item, index) => (
                <li
                  key={item.id}
                  id={`${listId}-${index}`}
                  role="option"
                  aria-selected={index === activeIndex}
                >
                  <button
                    type="button"
                    className={cn(
                      'w-full px-3 py-3 text-left text-[14px] hover:bg-(--color-bg-muted) focus:bg-(--color-bg-muted)',
                      index === activeIndex && 'bg-(--color-bg-muted)',
                    )}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => choose(item.name)}
                  >
                    {item.name}
                  </button>
                </li>
              ))}
              {matches.length === 0 ? (
                <li className="px-3 py-3 text-[13px]">{SERVICE_LOCATION_TEXT.noDistricts}</li>
              ) : null}
            </ul>
          ) : null}
        </div>
      </Field>
      {failure ? (
        <p role="alert" className="text-[13px] text-red-700 sm:col-span-2">
          {SERVICE_LOCATION_TEXT.loadFailed}
        </p>
      ) : null}
    </>
  );
}
