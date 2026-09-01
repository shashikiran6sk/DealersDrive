import type { CitiesResponse } from '@dealers-drive/contracts';
import type { ReactNode } from 'react';

import { CustomerHeader } from '@/components/layout/customer-header';
import { CustomerFooter } from '@/components/layout/customer-footer';
import { SavedCarsProvider } from '@/features/saved/saved-store';
import { apiGet } from '@/lib/api';

/**
 * The city list is the header's switcher, and nothing more.
 *
 * It is fetched in the layout, and a throw in a layout is not catchable by the
 * `error.tsx` of its own segment — it escapes every boundary below the root and
 * lands on `global-error.tsx`, which replaces the entire document. So a
 * momentarily unreachable `/v1/cities` would take down the whole buyer site,
 * catalogue and vehicle pages included, to lose one dropdown.
 *
 * Degrading is the proportionate response: the switcher falls back to "All of
 * Tamil Nadu" and every page below still renders. Failures those pages hit
 * themselves still throw, and `(public)/error.tsx` catches them there, where
 * the shell survives and the reader keeps a header to navigate with.
 */
const NO_CITIES: CitiesResponse = { data: [], default: 'all' };

/**
 * The buyer shell. No authentication anywhere below this layout, and no
 * sign-in gate on the catalogue, a vehicle page, a portfolio or an enquiry
 * form (DESIGN-SPEC §4.10).
 */
export default async function PublicLayout({ children }: { children: ReactNode }) {
  // City counts are live `APPROVED` totals; 60s at the edge is enough (§18).
  const cities = await apiGet<CitiesResponse>('/v1/cities', { revalidate: 60 }).catch(
    (error: unknown) => {
      console.error('city list unavailable; rendering the shell without it', error);
      return NO_CITIES;
    },
  );

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
