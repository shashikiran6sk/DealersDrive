import type { CatalogBundle, PublicConfig } from '@dealers-drive/contracts';
import type { Metadata } from 'next';

import { BasicsStep } from '@/features/vehicle/basics-step';
import { RegistrationStep } from '@/features/vehicle/registration-step';
import { apiGet } from '@/lib/api';

export const metadata: Metadata = { title: 'Add a vehicle' };

export default async function NewVehiclePage() {
  const [catalog, config] = await Promise.all([
    // The catalogue is shared, versioned and near-static — cache it for an hour
    // rather than shipping 12 makes of models on every wizard open (A13).
    apiGet<CatalogBundle>('/v1/catalog/bundle', { revalidate: 3600 }),
    // Five minutes, so flipping the flag reaches dealers without a redeploy.
    apiGet<PublicConfig>('/v1/config/public', { revalidate: 300 }),
  ]);

  /**
   * Both branches are complete intake flows, which is what makes
   * `feature.rcLookup` a real rollback rather than a half-disabled feature: off
   * is exactly the screen that shipped before this change, and the plate path
   * itself falls back to `BasicsStep` whenever a lookup fails.
   */
  return config.rcLookupEnabled ? (
    <RegistrationStep catalog={catalog} />
  ) : (
    <BasicsStep catalog={catalog} />
  );
}
