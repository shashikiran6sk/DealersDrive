import type { ReactNode } from 'react';

import { Field } from '@/components/forms/field';

import { FIELD_LABELS } from './vehicle-wizard.constants';

export function StepField({
  name,
  errors,
  hint,
  children,
  wide = false,
}: {
  name: string;
  errors: Record<string, string>;
  hint?: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <Field
      id={name}
      label={FIELD_LABELS[name] ?? name}
      hint={hint}
      error={errors[name]}
      className={wide ? 'col-span-full' : undefined}
    >
      {children}
    </Field>
  );
}
