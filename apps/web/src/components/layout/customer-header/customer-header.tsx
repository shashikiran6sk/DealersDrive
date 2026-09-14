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

/**
 * DESIGN-SPEC §3.1 — sticky, 64px, white on a hairline.
 *
 * A client component for one reason: `usePathname`, which marks the current
 * section. Everything else it renders is a link, so if the pathname ever stops
 * being read here the `'use client'` should go with it (invariant 8).
 *
 * ── Reconstruction slice ────────────────────────────────────────────────────
 * The **saved-cars count** is **F087**: `Saved cars` is a plain link here,
 * because the badge needs `SavedCarsProvider`, which reads `localStorage`. The
 * location button is **districts** rather than the baseline's cities — see
 * `LocationSelector` for why that is the better question at this level. The nav
 * points at `/cars` (**F077**), `/dealers` (**F085**) and `/saved` (**F087**),
 * which land after this one — the cost of bringing the shell across before the
 * rooms it frames.
 * ────────────────────────────────────────────────────────────────────────────
 */
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
          {/*
            The selector is the only part of the header that reads the query
            string, and `useSearchParams` opts a route out of static prerendering
            unless it sits behind a boundary. Keeping the boundary this tight
            means the rest of the header still renders on the server.
          */}
          <Suspense fallback={<LocationChipFallback />}>
            <LocationSelector locations={locations} />
          </Suspense>
          {/*
            One door, and it is a `/dealer` link (**R35**). The console already
            decides between "sign in" and "finish onboarding" from the session,
            so two buttons pointing at that one door only asked the visitor to
            guess — and either answer took them to the same screen. It carries
            `btn-primary` as the only action in the cluster, and is visible at
            every width because it is the only way in.
          */}
          <Link href={HEADER_NAV.dealerConsole} className="btn btn-primary">
            <span className="hidden lg:inline">{HEADER_TEXT.dealerLogin}</span>
            <span className="lg:hidden">{HEADER_TEXT.login}</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
