import type { ReactNode } from 'react';

import { Field } from '@/components/forms/field';
import { Input } from '@/components/ui/input';

import { EMPTY_VALUE } from './profile-form.constants';

export interface LockedFieldProps {
  id: string;
  label: string;
  value: string | null;
  mono?: boolean;
  children?: ReactNode;
}

export function LockedField({ id, label, value, mono, children }: LockedFieldProps) {
  return (
    <Field id={id} label={label}>
      <Input
        id={id}
        className={mono ? 'font-mono' : undefined}
        defaultValue={value ?? EMPTY_VALUE}
        disabled
      />
      {children}
    </Field>
  );
}
