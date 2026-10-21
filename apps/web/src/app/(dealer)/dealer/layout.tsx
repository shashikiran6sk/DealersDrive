import type { DealerProfile } from '@dealers-drive/contracts';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import {
  ADD_VEHICLE_HREF,
  ADD_VEHICLE_LABEL,
  ConsoleNav,
  consoleNavFor,
} from '@/components/dealer/console-nav';
import { MobileNav } from '@/components/layout/mobile-nav';
import {
  DEALER_NAV_LABEL,
  DEALER_ROOT_HREF,
} from '@/components/dealer/console-nav/console-nav.constants';
import { ButtonLink } from '@/components/ui/button';
import { ConsoleUtilities } from '@/components/dealer/console-utilities';
import { BrandLogo } from '@/components/brand-logo';
import { StatusTag } from '@/components/ui/primitives';
import { customerAccountAction } from '@/features/auth/customer-account-actions';
import { apiGet } from '@/lib/api';
import { currentSession, hasSession } from '@/lib/session';
import { seoMetadata } from '@/lib/seo';

export const dynamic = 'force-dynamic';

const DEALER_LOGIN_HREF = '/login?as=dealer';
const SESSION_EXPIRED_HREF = '/dealer/login?error=session_expired';

export const metadata: Metadata = {
  title: { default: 'Dealer console', template: '%s · Dealer console' },
  ...seoMetadata({ kind: 'private' }),
};

export default async function DealerLayout({ children }: { children: ReactNode }) {
  const [{ dealer, permissions }, account] = await Promise.all([
    requireDealer(),
    customerAccountAction(),
  ]);
  const nav = consoleNavFor(permissions);
  const navigation = <ConsoleNav items={nav} footer={<ConsoleUtilities account={account} />} />;

  return (
    <div className="flex min-h-dvh bg-white">
      <aside className="sticky top-0 hidden h-dvh w-[224px] flex-none flex-col gap-[28px] border-r border-(--color-divider) bg-(--color-sidebar) px-4 pt-[24px] pb-[20px] md:flex">
        <Link href="/" className="flex h-[30px] items-center gap-[10px] px-1 no-underline">
          <BrandLogo />
          <span className="font-heading text-[16px] font-extrabold tracking-[-0.02em]">
            Dealer console
          </span>
        </Link>

        {navigation}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-[15] flex h-[64px] flex-none items-center gap-3 border-b border-(--color-divider) bg-white px-4 md:h-[70px] md:px-8">
          <MobileNav
            items={nav}
            label={DEALER_NAV_LABEL}
            rootHref={DEALER_ROOT_HREF}
            navigation={navigation}
            heading={
              <>
                <p className="text-[14px] font-bold [overflow-wrap:anywhere]">{dealer.brandName}</p>
                <StatusTag tone={dealer.status === 'ACTIVE' ? 'ok' : 'warn'}>
                  {dealer.statusLabel}
                </StatusTag>
              </>
            }
          />
          <span className="min-w-0 truncate font-heading text-[16px] max-md:flex-1 font-extrabold tracking-[-0.02em]">
            {dealer.brandName}
          </span>
          <StatusTag
            tone={dealer.status === 'ACTIVE' ? 'ok' : 'warn'}
            className="flex-none max-md:hidden"
          >
            {dealer.statusLabel}
          </StatusTag>

          <ButtonLink href={ADD_VEHICLE_HREF} variant="primary" className="ml-auto max-md:hidden">
            {ADD_VEHICLE_LABEL}
          </ButtonLink>
        </header>

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}

async function requireDealer(): Promise<{ dealer: DealerProfile; permissions: string[] }> {
  const session = await currentSession();
  if (!session) {
    redirect((await hasSession()) ? DEALER_LOGIN_HREF : SESSION_EXPIRED_HREF);
  }
  if (session.next === 'ONBOARDING') redirect('/dealer/onboarding');

  const dealer = await apiGet<DealerProfile>('/v1/dealer', { revalidate: false });
  return { dealer, permissions: session.permissions };
}
