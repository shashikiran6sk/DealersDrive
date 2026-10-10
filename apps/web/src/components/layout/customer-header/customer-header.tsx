'use client';

import type { PublicLocations } from '@dealers-drive/contracts';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Suspense, type ReactNode } from 'react';

import { MobileNav } from '@/components/layout/mobile-nav';
import { LocationSelector } from '@/components/layout/location-selector';
import { BrandLogo } from '@/components/brand-logo';

import { HEADER_NAV, HEADER_TEXT, MOBILE_HEADER_NAV } from './customer-header.constants';
import { HeaderLink } from './header-link';
import { LocationChipFallback } from './location-chip-fallback';
import { LinkPendingLabel } from '@/components/ui/link-pending';

export interface CustomerHeaderProps {
  locations: PublicLocations;
  account?: ReactNode;
}

export function CustomerHeader({ locations, account }: CustomerHeaderProps) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-20 border-b border-(--color-divider) bg-white">
      <div className="mx-auto flex h-(--header-height) max-w-[1440px] items-center gap-3 px-4 max-sm:gap-2 max-sm:px-3 sm:gap-4 sm:px-6 md:gap-7 lg:px-10">
        <MobileNav
          items={MOBILE_HEADER_NAV}
          label={HEADER_TEXT.navLabel}
          rootHref={HEADER_NAV.home}
        >
          <nav aria-label="Account and support" className="flex flex-col gap-1">
            <Link href={HEADER_NAV.dealerLogin} className="dd-nav-item min-h-12">
              {HEADER_TEXT.dealerLogin}
            </Link>
            <Link href={HEADER_NAV.adminLogin} className="dd-nav-item min-h-12">
              {HEADER_TEXT.adminLogin}
            </Link>
            <Link href={HEADER_NAV.support} className="dd-nav-item min-h-12">
              {HEADER_TEXT.support}
            </Link>
          </nav>
        </MobileNav>
        <Link href="/" className="flex flex-none items-center gap-[10px]">
          <BrandLogo variant="dark" />
          <span className="font-heading text-[17px] font-extrabold tracking-[-0.02em] max-sm:sr-only">
            {HEADER_TEXT.brand}
          </span>
        </Link>

        <nav
          className="hidden gap-[24px] text-[14px] font-bold md:flex"
          aria-label={HEADER_TEXT.navLabel}
        >
          <HeaderLink href={HEADER_NAV.cars} active={pathname.startsWith(HEADER_NAV.cars)}>
            {HEADER_TEXT.buyCars}
          </HeaderLink>
          <HeaderLink href={HEADER_NAV.dealers} active={pathname.startsWith(HEADER_NAV.dealers)}>
            {HEADER_TEXT.dealers}
          </HeaderLink>
        </nav>

        <div className="ml-auto flex items-center gap-2 max-md:min-w-0">
          <Suspense fallback={<LocationChipFallback />}>
            <LocationSelector locations={locations} />
          </Suspense>
          {account ?? (
            <Link
              href={HEADER_NAV.login}
              className="relative btn btn-primary min-h-[40px] rounded-full px-[18px]"
            >
              <LinkPendingLabel>{HEADER_TEXT.login}</LinkPendingLabel>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
