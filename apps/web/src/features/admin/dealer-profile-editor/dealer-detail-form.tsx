'use client';

import { Field } from '@/components/forms/field';
import { Input } from '@/components/ui/input';

import { DEALER_EDITOR_TEXT, FIELDS } from './dealer-profile-editor.constants';
import type { FieldKey, Values } from './dealer-profile-editor.types';
import { errorFor } from './utils';

export interface DealerDetailFormProps {
  values: Values;
  errors: Record<string, string>;
  onChange: (key: FieldKey, value: string) => void;
}

/** The writable view — only rendered once *Edit* has been pressed. */
export function DealerDetailForm({ values, errors, onChange }: DealerDetailFormProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {FIELDS.map((field) => (
        <Field
          key={field.key}
          id={`dealer-${field.key}`}
          label={field.label}
          hint={'list' in field ? DEALER_EDITOR_TEXT.listHint : undefined}
          error={errorFor(errors, field.path)}
          className={'wide' in field ? 'sm:col-span-2' : undefined}
        >
          <Input
            id={`dealer-${field.key}`}
            className={field.mono ? 'font-mono' : undefined}
            value={values[field.key]}
            onChange={(event) =>
              onChange(
                field.key,
                'transform' in field ? field.transform(event.target.value) : event.target.value,
              )
            }
          />
        </Field>
      ))}
      <p className="text-[12px] ink-muted sm:col-span-2">{DEALER_EDITOR_TEXT.partialNote}</p>
    </div>
  );
}
