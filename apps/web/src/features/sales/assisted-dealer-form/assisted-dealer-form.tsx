'use client';

import { useState, type FormEvent } from 'react';

import { Field, invalidProps } from '@/components/forms/field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Banner } from '@/components/ui/primitives';
import { ServiceInput } from '@/components/ui/service-input';
import { cn } from '@/lib/cn';
import { useNavigationSafeAction } from '@/lib/use-navigation-safe-action';

import {
  ASSISTED_FORM_TEXT,
  BUSINESS_FIELDS,
  CONTACT_FIELDS,
  type AssistedField,
} from './assisted-dealer-form.constants';
import type { AssistedDealerFormProps } from './assisted-dealer-form.types';
import { valuesOf } from './utils';

export function AssistedDealerForm({
  initial,
  initialServices,
  submitLabel,
  partial,
  disabled = false,
  onSubmit,
  onDone,
}: AssistedDealerFormProps) {
  const [pending, startTransition] = useNavigationSafeAction();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = valuesOf(new FormData(event.currentTarget), partial);
    setErrors({});
    setMessage(null);
    setSaved(false);
    startTransition(async () => {
      const result = await onSubmit(values);
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        setMessage(result.message ?? null);
        return;
      }
      setSaved(true);
      onDone?.(result);
    });
  }

  function renderField(field: AssistedField) {
    const id = `assisted-${field.name}`;
    return (
      <Field
        key={field.name}
        id={id}
        label={field.label}
        hint={field.hint}
        error={errors[field.name]}
        className={cn(field.wide && 'sm:col-span-2')}
      >
        <Input
          id={id}
          name={field.name}
          type={field.type ?? 'text'}
          inputMode={field.inputMode}
          autoComplete={field.autoComplete}
          defaultValue={initial[field.name] ?? ''}
          required={field.required && !partial}
          aria-required={field.required || undefined}
          disabled={disabled}
          {...invalidProps(id, errors[field.name])}
        />
      </Field>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
      <fieldset className="m-0 grid min-w-0 gap-[14px] border-0 p-0 sm:grid-cols-2">
        <legend className="mb-2 text-[15px] font-semibold">
          {ASSISTED_FORM_TEXT.contactLegend}
        </legend>
        {CONTACT_FIELDS.map(renderField)}
      </fieldset>

      <fieldset className="m-0 grid min-w-0 gap-[14px] border-0 p-0 sm:grid-cols-2">
        <legend className="mb-2 text-[15px] font-semibold">
          {ASSISTED_FORM_TEXT.businessLegend}
        </legend>
        {BUSINESS_FIELDS.map(renderField)}
        <Field
          id="assisted-specialities"
          label={ASSISTED_FORM_TEXT.servicesLabel}
          hint={ASSISTED_FORM_TEXT.servicesHint}
          error={errors.specialities}
          className="sm:col-span-2"
        >
          <ServiceInput
            id="assisted-specialities"
            name="specialities"
            value={initialServices}
            disabled={disabled}
            required={!partial}
            {...invalidProps('assisted-specialities', errors.specialities)}
          />
        </Field>
      </fieldset>

      {message ? <Banner tone="err">{message}</Banner> : null}
      {saved && partial ? <Banner tone="ok">{ASSISTED_FORM_TEXT.saved}</Banner> : null}

      <div>
        <Button type="submit" size="md" loading={pending} disabled={disabled}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
