import type { AdminDealerDetail } from '@dealers-drive/contracts';

import { servicesOf } from '@/lib/services';

import { FIELDS } from './dealer-profile-editor.constants';
import type { Values } from './dealer-profile-editor.types';

export function initialValues(dealer: AdminDealerDetail): Values {
  return {
    legalName: dealer.legalName,
    gstin: dealer.gstin ?? '',
    pan: dealer.pan ?? '',
    addressLine: dealer.addressLine ?? '',
    city: dealer.city ?? '',
    district: dealer.district ?? '',
    state: dealer.state ?? '',
    pincode: dealer.pincode ?? '',
    mapsUrl: dealer.mapsUrl ?? '',
    contactName: dealer.contactName ?? '',
    contactPhone: dealer.contactPhone ?? '',
    contactEmail: dealer.contactEmail ?? '',
    landline: dealer.landline ?? '',
    tagline: dealer.tagline ?? '',
    specialities: dealer.specialities.join(', '),
  };
}

export function patchOf(values: Values, initial: Values): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  const groups = new Map<string, Record<string, unknown>>();

  for (const field of FIELDS) {
    const next = values[field.key].trim();
    if (next === initial[field.key].trim()) continue;

    const [head, leaf] = field.path.split('.');
    if (head === undefined) continue;

    if (leaf === undefined) {
      patch[head] = 'list' in field ? servicesOf(next) : next;
      continue;
    }

    const group = groups.get(head) ?? {};
    group[leaf] = next;
    groups.set(head, group);
    patch[head] = group;
  }

  return patch;
}

export function errorFor(errors: Record<string, string>, path: string): string | undefined {
  const leaf = path.split('.').pop() ?? path;
  const exact = errors[path] ?? errors[`body.${path}`] ?? errors[leaf] ?? errors[`body.${leaf}`];
  if (exact !== undefined) return exact;

  const beneath = Object.entries(errors).find(
    ([key]) => key.startsWith(`${path}.`) || key.startsWith(`body.${path}.`),
  );
  return beneath?.[1];
}
