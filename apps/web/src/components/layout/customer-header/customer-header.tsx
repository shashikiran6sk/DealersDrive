'use client';

import type { PublicLocations } from '@dealers-drive/contracts';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Suspense } from 'react';

import { LocationSelector } from '@/components/layout/location-selector';
import { Plate } from '@/components/ui/primitives';

import { HEADER_NAV, HEADER_TEXT } from './customer-header.constants';
import { HeaderLink } from './header-link';
import { LocationChipFallback } from './location-chip-fallback';

export function CustomerHeader({ locations }: { locations: PublicLocations }) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-20 border-b border-(--color-divider) bg-white">
      <div className="mx-auto flex h-16 max-w-[1280px] items-center gap-4 px-6 md:gap-7">
        <Link href="/" className="flex flex-none items-center gap-[9px]">
          <Plate size="logo">DD</Plate>
          <span className="font-heading text-[16px] font-bold">{HEADER_TEXT.brand}</span>
        </Link>

        <nav className="hidden gap-[22px] text-[14px] md:flex" aria-label={HEADER_TEXT.navLabel}>
          <HeaderLink href={HEADER_NAV.cars} active={pathname.startsWith(HEADER_NAV.cars)}>
            {HEADER_TEXT.buyCars}
          </HeaderLink>
          <HeaderLink href={HEADER_NAV.dealers} active={pathname.startsWith(HEADER_NAV.dealers)}>
            {HEADER_TEXT.dealers}
          </HeaderLink>
          <HeaderLink href={HEADER_NAV.saved} active={pathname.startsWith(HEADER_NAV.saved)}>
            {HEADER_TEXT.savedCars}
          </HeaderLink>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <Suspense fallback={<LocationChipFallback />}>
            <LocationSelector locations={locations} />
          </Suspense>
          <Link href={HEADER_NAV.dealerConsole} className="btn btn-primary">
            <span className="hidden lg:inline">{HEADER_TEXT.dealerLogin}</span>
            <span className="lg:hidden">{HEADER_TEXT.login}</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
