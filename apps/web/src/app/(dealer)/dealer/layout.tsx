import type { DealerProfile } from '@dealers-drive/contracts';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import {
  ADD_VEHICLE_HREF,
  ADD_VEHICLE_LABEL,
  ConsoleNav,
  ConsoleTabBar,
  consoleNavFor,
} from '@/components/dealer/console-nav';
import { ButtonLink } from '@/components/ui/button';
import { BrandLogo } from '@/components/brand-logo';
import { Blueprint, StatusTag } from '@/components/ui/primitives';
import { customerAccountAction } from '@/features/auth/customer-account-actions';
import { HeaderAccount } from '@/features/auth/header-account';
import { SignOutButton } from '@/features/auth/sign-out';
import { legalPagesVisible } from '@/lib/legal-release';
import { apiGet } from '@/lib/api';
import { currentSession, hasSession } from '@/lib/session';
import { seoMetadata } from '@/lib/seo';

export const dynamic = 'force-dynamic';

const HOME_HREF = '/';
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

  return (
    <div className="flex min-h-dvh bg-white">
      <aside className="sticky top-0 hidden h-dvh w-[224px] flex-none flex-col gap-[28px] border-r border-(--color-divider) bg-(--color-sidebar) px-4 pt-[24px] pb-[20px] md:flex">
        <Link href="/" className="flex h-[30px] items-center gap-[10px] px-1 no-underline">
          <BrandLogo />
          <span className="font-heading text-[16px] font-extrabold tracking-[-0.02em]">
            Dealer console
          </span>
        </Link>

        <ConsoleNav items={nav} />

        <Blueprint className="mt-auto rounded-[14px] bg-white p-4">
          <div className="text-[11px] font-extrabold uppercase tracking-[0.1em] ink-muted">
            Listing credits
          </div>
          <div className="my-[6px] font-heading text-[28px] font-extrabold leading-none tnum">
            {dealer.creditBalance}
          </div>
          {dealer.creditsHeld > 0 ? (
            <div className="mb-[6px] text-[11px] ink-subtle tnum">
              {dealer.creditsHeld} held for cars under review
            </div>
          ) : null}
        </Blueprint>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-[15] flex h-[64px] flex-none items-center gap-3 border-b border-(--color-divider) bg-white px-4 md:h-[70px] md:px-8">
          <span className="min-w-0 truncate font-heading text-[16px] font-extrabold tracking-[-0.02em]">
            {dealer.brandName}
          </span>
          <StatusTag tone={dealer.status === 'ACTIVE' ? 'ok' : 'warn'} className="flex-none">
            {dealer.statusLabel}
          </StatusTag>

          <span className="ml-auto whitespace-nowrap text-[13px] ink-muted tnum">
            {dealer.creditBalance} credits
          </span>
          <ButtonLink href={ADD_VEHICLE_HREF} variant="primary" className="max-md:hidden">
            {ADD_VEHICLE_LABEL}
          </ButtonLink>
          {account ? (
            <HeaderAccount initialAccount={account} afterLogoutHref={HOME_HREF} />
          ) : (
            <SignOutButton />
          )}
        </header>

        {legalPagesVisible() ? (
          <div className="border-b border-(--color-divider) px-4 py-3 text-[13px] md:px-8">
            <Link href="/agreements" className="underline">
              My agreements
            </Link>{' '}
            ·{' '}
            <Link href="/data-rights" className="underline">
              Privacy requests
            </Link>{' '}
            ·{' '}
            <Link href="/contact" className="underline">
              Support
            </Link>
          </div>
        ) : null}
        <main className="min-w-0 flex-1 pb-[60px] md:pb-0">{children}</main>
      </div>

      <ConsoleTabBar items={nav} />
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
