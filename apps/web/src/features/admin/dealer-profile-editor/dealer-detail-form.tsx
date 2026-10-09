'use client';

import { ServiceLocationFields } from '@/components/forms/service-location-fields/service-location-fields';

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

export function DealerDetailForm({ values, errors, onChange }: DealerDetailFormProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {FIELDS.map((field) =>
        field.key === 'district' ? (
          <ServiceLocationFields
            key="service-locations"
            prefix="dealer-"
            initialState={values.state ?? ''}
            initialDistrict={values.district ?? ''}
            onChange={onChange}
            errors={{
              state: errorFor(errors, 'address.state'),
              district: errorFor(errors, 'address.district'),
            }}
          />
        ) : field.key === 'state' ? null : (
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
        ),
      )}
      <p className="text-[12px] ink-muted sm:col-span-2">{DEALER_EDITOR_TEXT.partialNote}</p>
    </div>
  );
}
