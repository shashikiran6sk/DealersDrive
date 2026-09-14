'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tag } from '@/components/ui/primitives';

export interface ServiceInputProps {
  id: string;
  name?: string;
  value: string[];
  placeholder?: string;
  disabled?: boolean;
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

  const latest = useRef({ services, draft });
  latest.current = { services, draft };

  const full = services.length >= max;

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

      const next = [...latest.current.services];
      for (const entry of entries) {
        if (entry.length > maxLength) {
          overLength += 1;
          continue;
        }
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
          required={required && services.length === 0}
          aria-required={required && services.length === 0 ? 'true' : undefined}
          aria-invalid={ariaInvalid}
          aria-describedby={
            [describedBy, notice ? noticeId : null].filter(Boolean).join(' ') || undefined
          }
          onChange={(event) => {
            setDraft(event.target.value);
            if (notice) setNotice(null);
            if (event.target.value.includes(',')) {
              if (add(event.target.value)) setDraft('');
            }
          }}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return;
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

      <div
        className="flex flex-wrap gap-[6px] empty:hidden"
        role="group"
        aria-label="Services added"
        aria-live="polite"
      >
        {services.map((service, index) => (
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
