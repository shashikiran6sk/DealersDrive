import { servicesOf } from '@/lib/services';

import { REQUIRED_FIELD_NAMES, TEXT_FIELD_NAMES } from './assisted-dealer-form.constants';

const UPPERCASE = new Set(['gstin', 'pan']);

export function valuesOf(form: FormData, partial: boolean): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const name of TEXT_FIELD_NAMES) {
    const raw = form.get(name);
    const value = typeof raw === 'string' ? raw.trim() : '';
    if (value === '') {
      if (!partial && REQUIRED_FIELD_NAMES.has(name)) values[name] = '';
      continue;
    }
    values[name] = UPPERCASE.has(name) ? value.toUpperCase() : value;
  }
  const services = form.get('specialities');
  const list = servicesOf(typeof services === 'string' ? services : '');
  if (list.length > 0 || !partial) values.specialities = list;
  return values;
}
