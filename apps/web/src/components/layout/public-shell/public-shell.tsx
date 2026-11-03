import type { ReactNode } from 'react';
import { legalPagesVisible } from '@/lib/legal';

import { CustomerFooter } from '@/components/layout/customer-footer';
import { CustomerHeader } from '@/components/layout/customer-header';
import { HeaderAccount } from '@/features/auth/header-account';
import { SavedVehiclesProvider } from '@/features/saved';
import { popularSearches } from '@/lib/landing';
import { getPublicLocations } from '@/lib/locations';
import { getPublicConfig } from '@/lib/public-config';

export async function PublicShell({ children }: { children: ReactNode }) {
  const [locations, config, popular] = await Promise.all([
    getPublicLocations(),
    getPublicConfig(),
    popularSearches(),
  ]);

  return (
    <SavedVehiclesProvider>
      <div className="flex min-h-dvh flex-col">
        <CustomerHeader locations={locations} account={<HeaderAccount />} />
        <main className="flex-1">{children}</main>
        <CustomerFooter
          legalVisible={legalPagesVisible()}
          social={config.social}
          supportEmail={config.support.customer.email}
          supportPhone={config.support.customer.phone}
          popular={popular ?? []}
        />
      </div>
    </SavedVehiclesProvider>
  );
}
