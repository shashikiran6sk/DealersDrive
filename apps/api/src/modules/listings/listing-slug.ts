import { randomBytes } from 'node:crypto';

import { slugify } from '@dealers-drive/contracts';

const SUFFIX_BYTES = 4;

export interface SlugSource {
  manufacturingYear: number | null;
  make: string | null;
  model: string | null;
  variant: string | null;
}

export function listingSlug(vehicle: SlugSource, town: string | null): string {
  const words = [vehicle.manufacturingYear, vehicle.make, vehicle.model, vehicle.variant, town]
    .filter((part) => part !== null && part !== '')
    .join(' ');
  const suffix = randomBytes(SUFFIX_BYTES).toString('hex');
  const stem = slugify(words);
  return stem ? `${stem}-${suffix}` : `car-${suffix}`;
}
