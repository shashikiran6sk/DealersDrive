'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tag } from '@/components/ui/primitives';

import {
  DEFAULT_MAX_SERVICE_LENGTH,
  DEFAULT_MAX_SERVICES,
  SERVICE_INPUT_TEXT,
} from './service-input.constants';
import type { ServiceInputProps } from './service-input.types';
import { containsService, splitServiceEntries } from './utils';

/**
 * DESIGN-SPEC §2.5 — the services list, entered one service at a time (**R37**).
 *
 * `specialities` is an array in the contract and was a comma-separated text box,
 * which asked the dealer to hold a serialisation format in their head and hid
 * the one fact they most need to see: how many services they have named, and
 * which. Buyers already see this list as chips on the directory card and the
 * portfolio, so the editor is now the same picture.
 *
 * A hidden input carries `services.join(', ')` under `name` — exactly what the
 * comma-separated box submitted — so the wire format, the contract and the API
 * are untouched. The visible box has **no `name`**: it is the draft, not the
 * value, and a draft must not be submittable.
 */
export function ServiceInput({
  id,
  name,
  value,
  placeholder,
  disabled = false,
  required = false,
  max = DEFAULT_MAX_SERVICES,
  maxLength = DEFAULT_MAX_SERVICE_LENGTH,
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
   * The submit listener below is a native DOM handler and sees whatever was
   * current when it was attached, not when it fires. A ref is the value that
   * moves; the state is the value that renders.
   */
  const latest = useRef({ services, draft });
  latest.current = { services, draft };

  const full = services.length >= max;

  const add = useCallback(
    (raw: string): boolean => {
      const entries = splitServiceEntries(raw);
      if (entries.length === 0) return false;

      let duplicates = 0;
      let overLength = 0;
      let overflowed = false;

      /*
       * Computed from the ref rather than inside a `setServices` updater: an
       * updater does not run until React renders, so the counters would still be
       * zero when the message is chosen and when this function returns.
       */
      const next = [...latest.current.services];
      for (const entry of entries) {
        if (entry.length > maxLength) {
          overLength += 1;
          continue;
        }
        if (containsService(next, entry)) {
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
          ? SERVICE_INPUT_TEXT.tooLong(maxLength)
          : overflowed
            ? SERVICE_INPUT_TEXT.atLimit(max)
            : duplicates > 0
              ? duplicates === entries.length
                ? SERVICE_INPUT_TEXT.allDuplicates
                : SERVICE_INPUT_TEXT.someDuplicates
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
   * A service typed but not added is still a service the dealer meant to add —
   * without this, type-then-Continue silently discards the last thing they
   * wrote. Writing the hidden input's `value` directly is what makes it work: a
   * `setState` here would not have flushed before the form serialises.
   */
  useEffect(() => {
    const form = rootRef.current?.closest('form');
    if (!form) return;

    const onSubmit = (): void => {
      const { services: current, draft: pending } = latest.current;
      const entries = splitServiceEntries(pending).filter(
        (entry) => entry.length <= maxLength && !containsService(current, entry),
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
          placeholder={full ? SERVICE_INPUT_TEXT.atLimitPlaceholder(max) : placeholder}
          autoComplete="off"
          /*
           * `required` only while the list is empty, and on the *draft* box
           * rather than the hidden input: the browser cannot focus or message a
           * hidden control, so the native refusal would have been a form that
           * silently would not submit.
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
          {SERVICE_INPUT_TEXT.addLabel}
        </Button>
      </div>

      {/*
        A `group` rather than a `list`, deliberately: every onboarding step
        already contains one `<ol>`, the stepper, so a second list role makes
        `getByRole('list')` ambiguous. `aria-live` because adding a chip changes
        this row without moving focus.
      */}
      <div
        className="flex flex-wrap gap-[6px] empty:hidden"
        role="group"
        aria-label={SERVICE_INPUT_TEXT.chipsLabel}
        aria-live="polite"
      >
        {services.map((service, index) => (
          /* The first chip takes the accent, as the directory card renders it (**R29**). */
          <Tag key={service} variant={index === 0 ? 'accent' : 'neutral'}>
            {service}
            {disabled ? null : (
              <button
                type="button"
                onClick={() => {
                  remove(service);
                }}
                aria-label={SERVICE_INPUT_TEXT.removeLabel(service)}
                className="-mr-[3px] cursor-pointer rounded-[2px] px-[3px] leading-none opacity-70 hover:opacity-100 focus-visible:opacity-100"
              >
                <span aria-hidden="true">{SERVICE_INPUT_TEXT.removeGlyph}</span>
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
