import type { ReactNode } from 'react';

import { CustomerFooter } from '@/components/layout/customer-footer';
import { CustomerHeader } from '@/components/layout/customer-header';

/**
 * The buyer shell. No authentication anywhere below this layout, and no
 * sign-in gate on the catalogue, a vehicle page, a portfolio or an enquiry
 * form (DESIGN-SPEC §4.10).
 *
 * ── Reconstruction slice ────────────────────────────────────────────────────
 * The baseline's layout was `async` and fetched `GET /v1/cities` for the header's
 * switcher, with a `.catch` that degraded to an empty list — because a throw in
 * a layout escapes every boundary below the root and lands on
 * `global-error.tsx`, replacing the whole document to lose one dropdown.
 *
 * There is nothing to fetch here any more. **D6** withdrew F026 and the `cities`
 * table with it, and the switcher's list becomes the cities dealers actually
 * trade in, counted from `listing_search` at **F076** and rendered by **F074**.
 * So this layout is synchronous and cannot fail — and when F074 restores the
 * fetch, the reasoning above is the thing to restore with it.
 *
 * `SavedCarsProvider` wraps this tree from **F087**.
 * ────────────────────────────────────────────────────────────────────────────
 */
export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <CustomerHeader />
      <main className="flex-1">{children}</main>
      <CustomerFooter />
    </div>
  );
}
