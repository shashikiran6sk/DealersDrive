'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tag } from '@/components/ui/primitives';

/**
 * DESIGN-SPEC §2.5 — the services list, entered one service at a time (**R37**).
 *
 * ── Why this exists ─────────────────────────────────────────────────────────
 * `specialities` is an array in the contract and was a comma-separated text box
 * on both screens that write it. That asked the dealer to hold a serialisation
 * format in their head — is a comma inside a service name allowed? does a
 * trailing comma make an empty one? — and it hid the one fact they most need to
 * see, which is *how many services they have named and which*. A dealer
 * reviewing `Finance, exchange, RC transfer, in-house workshop, insurance` in a
 * single-line input is reading their own answer through a keyhole.
 *
 * Buyers already see this list as chips, on the directory card and on the
 * portfolio. So does the admin review screen. This makes the editor the same
 * picture: **what you are building is what a buyer will see.**
 *
 * ── How it submits ──────────────────────────────────────────────────────────
 * A hidden input carries `services.join(', ')` under `name`, which is exactly
 * what the comma-separated box submitted. `servicesOf()` in the two server
 * actions is unchanged and still the single parse — so the wire format, the
 * contract and the API are untouched by this component, and a screen that has
 * not adopted it yet cannot disagree with one that has.
 *
 * The visible text box has **no `name`**: it is the draft, not the value, and a
 * draft must not be submittable. That is the same rule `LockedField` relies on
 * (R27) and it is what makes the hidden input the only thing that speaks.
 */
export interface ServiceInputProps {
  /** Labels the visible draft box, so the `<Field>`'s label points at it. */
  id: string;
  /** The form key. `undefined` submits nothing — the R34 waiting-for-review lock. */
  name?: string;
  value: string[];
  placeholder?: string;
  disabled?: boolean;
  /** Blocks submit with the browser's own message while the list is empty. */
  required?: boolean;
  max?: number;
  maxLength?: number;
  'aria-invalid'?: boolean | 'true' | 'false';
  'aria-describedby'?: string;
}

const DEFAULT_MAX = 12;
const DEFAULT_MAX_LENGTH = 60;

export function ServiceInput({
  id,
  name,
  value,
  placeholder,
  disabled = false,
  required = false,
  max = DEFAULT_MAX,
  maxLength = DEFAULT_MAX_LENGTH,
  'aria-invalid': ariaInvalid,
  'aria-describedby': describedBy,
}: ServiceInputProps) {
  const [services, setServices] = useState<string[]>(value);
  const [draft, setDraft] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const noticeId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const hiddenRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  /*
   * The draft is read by the submit listener below, which is a native DOM
   * handler and therefore sees whatever was current when it was attached
   * rather than whatever is current when it fires. A ref is the value that
   * moves; the state is the value that renders.
   */
  const latest = useRef({ services, draft });
  latest.current = { services, draft };

  const full = services.length >= max;

  /**
   * One entry, or several when a comma-separated string is pasted in.
   *
   * Splitting on paste is not a convenience — it is the reason a dealer who
   * copies their service list out of WhatsApp does not end up with one chip
   * sixty characters long that the contract then refuses.
   */
  const add = useCallback(
    (raw: string): boolean => {
      const entries = raw
        .split(',')
        .map((entry) => entry.trim().replace(/\s+/g, ' '))
        .filter((entry) => entry.length > 0);

      if (entries.length === 0) return false;

      let duplicates = 0;
      let overLength = 0;
      let overflowed = false;

      /*
       * Computed from the ref rather than inside a `setServices` updater. An
       * updater does not run until React renders, so the three counters below
       * would still be zero when the message is chosen and when this function
       * returns — which is the difference between "already added" and silence,
       * and between keeping the dealer's text and clearing it.
       */
      const next = [...latest.current.services];
      for (const entry of entries) {
        if (entry.length > maxLength) {
          overLength += 1;
          continue;
        }
        // Case-insensitively, because "RC transfer" and "RC Transfer" are one
        // service and a buyer comparing two dealerships should not see both.
        if (next.some((existing) => existing.toLowerCase() === entry.toLowerCase())) {
          duplicates += 1;
          continue;
        }
        if (next.length >= max) {
          overflowed = true;
          break;
        }
        next.push(entry);
      }
      setServices(next);

      setNotice(
        overLength > 0
          ? `Keep each service to ${String(maxLength)} characters or fewer.`
          : overflowed
            ? `That is the ${String(max)}-service limit — remove one to add another.`
            : duplicates > 0
              ? duplicates === entries.length
                ? 'You have already added that one.'
                : 'Some of those were already on the list.'
              : null,
      );

      // Every entry was refused, so the box keeps what the dealer typed: there
      // is nothing to retype and the message says what to change.
      return !(duplicates === entries.length || overLength === entries.length);
    },
    [max, maxLength],
  );

  function commitDraft(): void {
    if (add(draft)) setDraft('');
    inputRef.current?.focus();
  }

  function remove(service: string): void {
    setServices((current) => current.filter((entry) => entry !== service));
    setNotice(null);
  }

  /**
   * A service typed but not added is still a service the dealer meant to add.
   *
   * Without this, the most natural mistake on the screen — type, then press
   * Continue — silently discards the last thing they wrote, and the failure is
   * invisible until they look at their own public page. Writing the hidden
   * input's `value` directly is what makes the fix work: a `setState` here
   * would not have flushed before the form serialises.
   */
  useEffect(() => {
    const form = rootRef.current?.closest('form');
    if (!form) return;

    const onSubmit = (): void => {
      const { services: current, draft: pending } = latest.current;
      const entries = pending
        .split(',')
        .map((entry) => entry.trim().replace(/\s+/g, ' '))
        .filter(
          (entry) =>
            entry.length > 0 &&
            entry.length <= maxLength &&
            !current.some((existing) => existing.toLowerCase() === entry.toLowerCase()),
        );
      if (entries.length === 0) return;

      const merged = [...current, ...entries].slice(0, max);
      if (hiddenRef.current) hiddenRef.current.value = merged.join(', ');
      setServices(merged);
      setDraft('');
    };

    form.addEventListener('submit', onSubmit, { capture: true });
    return () => {
      form.removeEventListener('submit', onSubmit, { capture: true });
    };
  }, [max, maxLength]);

  return (
    <div ref={rootRef} className="flex flex-col gap-[8px]">
      {name === undefined ? null : (
        <input ref={hiddenRef} type="hidden" name={name} value={services.join(', ')} readOnly />
      )}

      <div className="flex items-start gap-[8px]">
        <Input
          ref={inputRef}
          id={id}
          value={draft}
          disabled={disabled || full}
          maxLength={maxLength}
          placeholder={full ? `${String(max)} services is the limit` : placeholder}
          autoComplete="off"
          /*
           * `required` only while the list is empty, and on the *draft* box
           * rather than on the hidden input: the browser cannot focus or
           * message a hidden control, so the native refusal would have been a
           * form that silently would not submit.
           */
          required={required && services.length === 0}
          aria-required={required && services.length === 0 ? 'true' : undefined}
          aria-invalid={ariaInvalid}
          aria-describedby={
            [describedBy, notice ? noticeId : null].filter(Boolean).join(' ') || undefined
          }
          onChange={(event) => {
            setDraft(event.target.value);
            if (notice) setNotice(null);
            // A typed or pasted comma means the entry is finished.
            if (event.target.value.includes(',')) {
              if (add(event.target.value)) setDraft('');
            }
          }}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return;
            // Otherwise Enter submits the whole onboarding step, which is the
            // opposite of what pressing it in this box means.
            event.preventDefault();
            commitDraft();
          }}
        />
        <Button
          type="button"
          variant="secondary"
          className="h-[38px] flex-none"
          disabled={disabled || full || draft.trim().length === 0}
          onClick={commitDraft}
        >
          Add
        </Button>
      </div>

      {/*
        A `group` rather than a `list`, deliberately. The chips are the same
        picture the directory card draws and that row is not a list either —
        and every onboarding step already contains one `<ol>`, the stepper, so a
        second list role here makes `getByRole('list')` ambiguous on a screen
        whose only list is meant to be the progress indicator.

        `aria-live` because adding a chip changes this row without moving focus:
        a screen reader is told what happened rather than having to be steered
        back to find out.
      */}
      <div
        className="flex flex-wrap gap-[6px] empty:hidden"
        role="group"
        aria-label="Services added"
        aria-live="polite"
      >
        {services.map((service, index) => (
          /*
           * The first chip takes the accent, which is the rule the directory
           * card renders by (**R29**) — so the editor and the card are not only
           * the same shape but the same picture.
           */
          <Tag key={service} variant={index === 0 ? 'accent' : 'neutral'}>
            {service}
            {disabled ? null : (
              <button
                type="button"
                onClick={() => {
                  remove(service);
                }}
                aria-label={`Remove ${service}`}
                className="-mr-[3px] cursor-pointer rounded-[2px] px-[3px] leading-none opacity-70 hover:opacity-100 focus-visible:opacity-100"
              >
                <span aria-hidden="true">×</span>
              </button>
            )}
          </Tag>
        ))}
      </div>

      {notice ? (
        <p id={noticeId} role="status" className="text-[11px] text-(--color-err)">
          {notice}
        </p>
      ) : null}
    </div>
  );
}
