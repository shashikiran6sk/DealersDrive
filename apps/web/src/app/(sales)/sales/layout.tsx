import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { BrandLogo } from '@/components/brand-logo';
import { ConsoleNav, ConsoleTabBar } from '@/components/dealer/console-nav';
import { MobileNav } from '@/components/layout/mobile-nav';
import { ButtonLink } from '@/components/ui/button';
import { SignOutButton } from '@/features/auth/sign-out';
import {
  ADD_DEALERSHIP_HREF,
  SALES_NAV,
  SALES_NAV_LABEL,
  SALES_ROOT_HREF,
  SALES_TEXT,
} from '@/features/sales/sales.constants';
import { requireSalesMember } from '@/lib/sales-session';
import { seoMetadata } from '@/lib/seo';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: { default: 'Sales workspace', template: '%s · Sales' },
  ...seoMetadata({ kind: 'private' }),
};

export default async function SalesLayout({ children }: { children: ReactNode }) {
  const { member } = await requireSalesMember();

  return (
    <div className="flex min-h-dvh bg-white">
      <aside className="sticky top-0 hidden h-dvh w-[224px] flex-none flex-col gap-[28px] border-r border-(--color-divider) bg-(--color-sidebar) px-4 pt-[24px] pb-[20px] md:flex">
        <Link
          href={SALES_ROOT_HREF}
          className="flex h-[30px] items-center gap-[10px] px-1 no-underline"
        >
          <BrandLogo />
          <span className="font-heading text-[16px] font-extrabold tracking-[-0.02em]">
            {SALES_TEXT.brand}
          </span>
        </Link>
        <ConsoleNav items={SALES_NAV} label={SALES_NAV_LABEL} rootHref={SALES_ROOT_HREF} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-[15] flex h-[64px] flex-none items-center gap-3 border-b border-(--color-divider) bg-white px-4 md:h-[70px] md:px-8">
          <MobileNav items={SALES_NAV} label={SALES_NAV_LABEL} rootHref={SALES_ROOT_HREF} />
          <span className="min-w-0 truncate font-heading text-[16px] font-extrabold tracking-[-0.02em] md:hidden">
            {SALES_TEXT.brand}
          </span>
          <span className="ml-auto min-w-0 truncate text-[12px] ink-muted">{member.email}</span>
          <ButtonLink href={ADD_DEALERSHIP_HREF} variant="primary" className="max-md:hidden">
            {SALES_TEXT.addDealership}
          </ButtonLink>
          <SignOutButton scope="admin" />
        </header>
        <main className="min-w-0 flex-1 pb-[calc(60px+env(safe-area-inset-bottom))] md:pb-0">
          {children}
        </main>
      </div>

      <ConsoleTabBar items={SALES_NAV} label={SALES_NAV_LABEL} rootHref={SALES_ROOT_HREF} />
    </div>
  );
}
