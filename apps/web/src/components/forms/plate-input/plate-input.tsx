'use client';

import { formatRegistration, parseRegistration } from '@dealers-drive/contracts';
import { useState, type FocusEvent } from 'react';

import { Field, invalidProps } from '@/components/forms/field';

import { PLATE_INPUT_TEXT, PLATE_MAX_LENGTH } from './plate-input.constants';
import type { PlateInputProps } from './plate-input.types';

export function PlateInput({
  id,
  name = id,
  label = PLATE_INPUT_TEXT.label,
  defaultValue,
  error,
  hint = PLATE_INPUT_TEXT.hint,
  disabled = false,
  autoFocus = false,
  required = false,
}: PlateInputProps) {
  const [localError, setLocalError] = useState<string>();
  const shown = localError ?? error;

  function onBlur(event: FocusEvent<HTMLInputElement>) {
    const raw = event.currentTarget.value;
    if (!raw.trim()) {
      setLocalError(undefined);
      return;
    }
    const result = parseRegistration(raw);
    if (result.ok) {
      event.currentTarget.value = result.value.display;
      setLocalError(undefined);
    } else {
      setLocalError(result.message);
    }
  }

  return (
    <Field id={id} label={label} hint={hint} error={shown}>
      <input
        id={id}
        name={name}
        type="text"
        inputMode="text"
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        maxLength={PLATE_MAX_LENGTH}
        placeholder={PLATE_INPUT_TEXT.placeholder}
        defaultValue={defaultValue ? formatRegistration(defaultValue) : undefined}
        disabled={disabled}
        required={required}
        autoFocus={autoFocus}
        onBlur={onBlur}
        onInput={() => setLocalError(undefined)}
        className="input dd-plate-input"
        {...invalidProps(id, shown)}
      />
    </Field>
  );
}
