'use client';

import type { PublicLocations } from '@dealers-drive/contracts';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Suspense, type ReactNode } from 'react';

import { LocationSelector } from '@/components/layout/location-selector';
import { Plate } from '@/components/ui/primitives';
import { cn } from '@/lib/cn';

/**
 * DESIGN-SPEC §3.1 — sticky, 64px, white on a hairline.
 *
 * A client component for one reason: `usePathname`, which is what marks the
 * current section. Everything else it renders is a link, and a link needs no
 * JavaScript — so if the pathname ever stops being read here, the `'use
 * client'` should go with it (invariant 8).
 *
 * ── Reconstruction slice ────────────────────────────────────────────────────
 * One piece of the baseline's header is still held back: **the saved-cars
 * count** is **F087**. `Saved cars` is a plain link here; the badge needs
 * `SavedCarsProvider`, which reads `localStorage`.
 *
 * The location button is here, and it is **districts** rather than the
 * baseline's cities — see `LocationSelector` for why that is the better
 * question at this level, and not merely the one D6 left available.
 *
 * The nav points at `/cars` (**F077**), `/dealers` (**F085**) and `/saved`
 * (**F087**). Those routes land after this one — which is the cost of bringing
 * the shell across before the rooms it frames, and the order Tier 12 chose.
 * ────────────────────────────────────────────────────────────────────────────
 */
export function CustomerHeader({ locations }: { locations: PublicLocations }) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-20 border-b border-(--color-divider) bg-white">
      <div className="mx-auto flex h-16 max-w-[1280px] items-center gap-4 px-6 md:gap-7">
        <Link href="/" className="flex flex-none items-center gap-[9px]">
          <Plate size="logo">DD</Plate>
          <span className="font-heading text-[16px] font-bold">Dealers-Drive</span>
        </Link>

        <nav className="hidden gap-[22px] text-[14px] md:flex" aria-label="Main">
          <HeaderLink href="/cars" active={pathname.startsWith('/cars')}>
            Buy cars
          </HeaderLink>
          <HeaderLink href="/dealers" active={pathname.startsWith('/dealers')}>
            Dealers
          </HeaderLink>
          <HeaderLink href="/saved" active={pathname.startsWith('/saved')}>
            Saved cars
          </HeaderLink>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {/*
            The selector is the only part of the header that reads the query
            string, and `useSearchParams` opts a route out of static
            prerendering unless it sits behind a boundary. Keeping the boundary
            this tight means the rest of the header — logo, nav, the two doors —
            still renders on the server, and the button arrives with the same
            markup a moment later.
          */}
          <Suspense fallback={<LocationChipFallback />}>
            <LocationSelector locations={locations} />
          </Suspense>
          {/*
            Both go to `/dealer`. There is one door for a dealership — the
            console decides between "sign in" and "finish onboarding" from the
            session, so the header does not have to guess which of the two a
            visitor needs, and cannot get it wrong.
          */}
          <Link
            href="/dealer"
            className="btn btn-secondary hidden border-transparent sm:inline-flex"
          >
            <span className="hidden lg:inline">Dealer login</span>
            <span className="lg:hidden">Login</span>
          </Link>
          <Link href="/dealer" className="btn btn-primary">
            <span className="hidden lg:inline">List your cars</span>
            <span className="lg:hidden">List cars</span>
          </Link>
        </div>
      </div>
    </header>
  );
}

/**
 * The button's own footprint, so the header does not reflow when the real one
 * arrives. It reads "All districts" because that is what the button says for
 * every visitor who has not chosen one.
 */
function LocationChipFallback() {
  return (
    <span className="btn btn-secondary flex items-center gap-[7px]" aria-hidden="true">
      <span className="block h-[14px] w-[5px] bg-(--color-accent)" />
      All districts <span>▾</span>
    </span>
  );
}

/**
 * `aria-current="page"` as well as the colour, because status is never carried
 * by colour alone (DESIGN-SPEC §4.15) — a screen reader announces the current
 * section, and so does a monochrome display.
 */
export function HeaderLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(active && 'text-(--color-accent-700)')}
    >
      {children}
    </Link>
  );
}
