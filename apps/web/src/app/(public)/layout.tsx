import type { ReactNode } from 'react';

import { CustomerFooter } from '@/components/layout/customer-footer';
import { CustomerHeader } from '@/components/layout/customer-header';
import { getPublicLocations } from '@/lib/locations';
import { getPublicConfig } from '@/lib/public-config';

export default async function PublicLayout({ children }: { children: ReactNode }) {
  const [locations, config] = await Promise.all([getPublicLocations(), getPublicConfig()]);

  return (
    <div className="flex min-h-dvh flex-col">
      <CustomerHeader locations={locations} />
      <main className="flex-1">{children}</main>
      <CustomerFooter
        social={config.social}
        supportEmail={config.supportEmail}
        supportPhone={config.supportPhone}
      />
    </div>
  );
}
