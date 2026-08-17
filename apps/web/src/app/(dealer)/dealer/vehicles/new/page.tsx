import type { CatalogBundle } from '@dealers-drive/contracts';
import type { Metadata } from 'next';

import { BasicsStep } from '@/features/vehicle/basics-step';
import { apiGet } from '@/lib/api';

export const metadata: Metadata = { title: 'Add a vehicle' };

export default async function NewVehiclePage() {
  // The catalogue is shared, versioned and near-static — cache it for an hour
  // rather than shipping 12 makes of models on every wizard open (A13).
  const catalog = await apiGet<CatalogBundle>('/v1/catalog/bundle', { revalidate: 3600 });

  return <BasicsStep catalog={catalog} />;
}
