'use client';

import { REGISTRATION_NUMBER } from '@dealers-drive/contracts';

import { Field } from '@/components/forms/field';

/**
 * The number-plate field.
 *
 * Separators are the whole reason this is a component rather than an `<input>`
 * with a pattern. A dealer copying a number off a windscreen writes
 * `TN 09 BX 1234`, `TN-09-BX-1234` or `tn09bx1234` depending on habit, and
 * rejecting two of those would be the form telling them they typed their own
 * car's registration wrongly. All three are accepted; the value is normalised
 * on the way out.
 *
 * `REGISTRATION_NUMBER` is imported from `@dealers-drive/contracts` — the same
 * schema the API validates with. Browser and server therefore agree on what a
 * plate is by construction rather than by two regexes someone kept in sync.
 */
export function PlateInput({
  value,
  onChange,
  error,
  disabled = false,
  autoFocus = false,
}: {
  value: string;
  onChange: (next: string) => void;
  error?: string | undefined;
  disabled?: boolean;
  autoFocus?: boolean;
}) {
  return (
    <Field
      id="regNumber"
      label="Registration number"
      hint="(spaces and dashes are fine)"
      error={error}
    >
      <input
        id="regNumber"
        name="regNumber"
        className="input tnum text-[22px] tracking-[0.14em] uppercase"
        placeholder="TN 09 BX 1234"
        autoComplete="off"
        // A number plate is not a word. Autocorrect on a phone keyboard turns
        // `TN` into `In` and the dealer cannot see why the form is refusing.
        autoCorrect="off"
        autoCapitalize="characters"
        spellCheck={false}
        // `characters` above handles display; this keeps the *value* upper so
        // what is submitted matches what is shown.
        value={value}
        maxLength={16}
        disabled={disabled}
        autoFocus={autoFocus}
        onChange={(event) => onChange(event.target.value.toUpperCase())}
      />
    </Field>
  );
}

/**
 * Client-side plate validation, for the message only.
 *
 * The API runs the same schema and is what actually enforces it, so a crafted
 * request gets a 400 rather than a lookup. This exists so a typo costs a
 * dealer an inline hint instead of a round trip — and, because the lookup is
 * billed per call, so a malformed plate never reaches a provider at all.
 */
export function validatePlate(raw: string): string | undefined {
  if (raw.trim() === '') return 'Enter the registration number.';
  const parsed = REGISTRATION_NUMBER.safeParse(raw);
  return parsed.success ? undefined : 'Enter a registration number like TN 09 BX 1234.';
}

/** The normalised form the API expects: no spaces, no dashes, upper case. */
export function normalisePlate(raw: string): string {
  const parsed = REGISTRATION_NUMBER.safeParse(raw);
  return parsed.success
    ? parsed.data
    : raw
        .trim()
        .toUpperCase()
        .replace(/[\s-]+/g, '');
}
