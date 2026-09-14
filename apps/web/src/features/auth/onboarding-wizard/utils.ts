import { isIndianMobile, type CompletenessResponse } from '@dealers-drive/contracts';

import { MISSING_LABELS, ONBOARDING_TEXT } from './onboarding-wizard.constants';

/**
 * The required fields of step 1, read straight off the form.
 *
 * Off the DOM rather than out of React state, because these inputs are
 * uncontrolled — they carry `defaultValue` so that re-rendering the step never
 * discards what is half-typed in it. The form element is the state.
 */
export function validateAccount(form: HTMLFormElement | null): Record<string, string> {
  if (!form) return {};

  const value = (name: string): string => {
    const field = form.elements.namedItem(name);
    return field instanceof HTMLInputElement || field instanceof HTMLSelectElement
      ? field.value.trim()
      : '';
  };

  const errors: Record<string, string> = {};
  if (value('fullName').length < 2) errors.fullName = ONBOARDING_TEXT.missingName;
  // The same predicate the API validates with, imported rather than copied — the
  // copy that used to live here disagreed with the placeholder beside it about
  // whether `98400 12345` is a phone number.
  if (!isIndianMobile(value('phone'))) errors.phone = ONBOARDING_TEXT.missingPhone;
  return errors;
}

/**
 * Ten digits, whatever shape the number arrived in.
 *
 * `users.phone` is E.164 (`+919840012345`), `dealers.contactPhone` mirrors it,
 * and the box asks for the ten digits under the `+91` prefix beside it. One
 * reduction, used for the box's value *and* for the comparison that decides
 * whether the number in it is the verified one — two would eventually disagree,
 * and the disagreement would be a dealer re-verifying a number they had proved.
 */
export function localDigits(value: string | null | undefined): string {
  const digits = (value ?? '').replace(/\D/g, '');
  return digits.length > 10 ? digits.slice(-10) : digits;
}

export function outstandingLabels(completeness: CompletenessResponse | null): string[] {
  return (completeness?.steps ?? [])
    .flatMap((step) => step.missing)
    .map((key) => MISSING_LABELS[key] ?? key);
}

/** The same, for one named step. */
export function stepOutstanding(completeness: CompletenessResponse | null, key: string): string[] {
  const step = completeness?.steps.find((candidate) => candidate.key === key);
  return (step?.missing ?? []).map((field) => MISSING_LABELS[field] ?? field);
}
