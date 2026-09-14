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

/**
 * A fact about the dealership, in the shape of the field it used to be (**R27**).
 *
 * `disabled` and **without a `name`**, which is the load-bearing half: a
 * disabled control is not submitted, and one with no name has nothing to be
 * submitted under. So a locked value cannot reach `saveDealerProfileAction` even
 * by accident, and the action does not have to filter it out.
 *
 * A box rather than a `<dl>` row, because that is what this page has always done
 * with GSTIN and PAN. `—` for a value the dealership never gave: an empty control
 * under a label reads as a box you have not filled in yet.
 */
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
