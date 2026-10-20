import type { ReactNode } from 'react';

import { CustomerFooter } from '@/components/layout/customer-footer';
import { CustomerHeader } from '@/components/layout/customer-header';
import { HeaderAccount } from '@/features/auth/header-account';
import { SavedVehiclesProvider } from '@/features/saved';
import { getPublicLocations } from '@/lib/locations';
import { getPublicConfig } from '@/lib/public-config';

export async function PublicShell({ children }: { children: ReactNode }) {
  const [locations, config] = await Promise.all([getPublicLocations(), getPublicConfig()]);

  return (
    <SavedVehiclesProvider>
      <div className="flex min-h-dvh flex-col">
        <CustomerHeader locations={locations} account={<HeaderAccount />} />
        <main className="flex-1">{children}</main>
        <CustomerFooter
          social={config.social}
          supportEmail={config.supportEmail}
          supportPhone={config.supportPhone}
        />
      </div>
    </SavedVehiclesProvider>
  );
}
