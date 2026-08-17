import type { CitiesResponse } from '@dealers-drive/contracts';
import type { ReactNode } from 'react';

import { CustomerHeader } from '@/components/layout/customer-header';
import { CustomerFooter } from '@/components/layout/customer-footer';
import { SavedCarsProvider } from '@/features/saved/saved-store';
import { apiGet } from '@/lib/api';

/**
 * The buyer shell. No authentication anywhere below this layout, and no
 * sign-in gate on the catalogue, a vehicle page, a portfolio or an enquiry
 * form (DESIGN-SPEC §4.10).
 */
export default async function PublicLayout({ children }: { children: ReactNode }) {
  // City counts are live `APPROVED` totals; 60s at the edge is enough (§18).
  const cities = await apiGet<CitiesResponse>('/v1/cities', { revalidate: 60 });

  return (
    <SavedCarsProvider>
      <div className="flex min-h-dvh flex-col">
        <CustomerHeader cities={cities} />
        <main className="flex-1">{children}</main>
        <CustomerFooter />
      </div>
    </SavedCarsProvider>
  );
}
