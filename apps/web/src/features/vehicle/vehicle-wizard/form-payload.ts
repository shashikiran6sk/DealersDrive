import { NUMBER_FIELDS } from './vehicle-wizard.constants';
import { rupeesToPaise } from './utils';

export function payloadFor(fields: readonly string[], formData: FormData): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const field of fields) {
    const value = formData.get(field);
    const raw = typeof value === 'string' ? value.trim() : '';

    if (field === 'priceRupees') {
      payload.pricePaise = rupeesToPaise(raw);
    } else if (field === 'registrationNumber') {
      payload.registrationNumber = raw;
    } else if (NUMBER_FIELDS.has(field)) {
      const digits = raw.replace(/[,\s]/g, '');
      payload[field] = digits === '' ? null : /^\d+$/.test(digits) ? Number(digits) : Number.NaN;
    } else {
      payload[field] = raw === '' ? null : raw;
    }
  }
  return payload;
}
