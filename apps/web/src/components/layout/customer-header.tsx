'use client';

import type { CitiesResponse } from '@dealers-drive/contracts';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useId, useRef, useState } from 'react';

import { Plate } from '@/components/ui/primitives';
import { useSavedCars } from '@/features/saved/saved-store';
import { cn } from '@/lib/cn';

/**
 * DESIGN-SPEC §3.1 — sticky, 64px, white on a hairline.
 *
 * A client component for exactly two reasons: the city dropdown, and the saved
 * badge which reads `localStorage`. Everything else it renders is a link.
 */
export function CustomerHeader({ cities }: { cities: CitiesResponse }) {
  const pathname = usePathname();
  const { count, hydrated } = useSavedCars();

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
            Saved cars{hydrated && count > 0 ? <span className="tnum"> ({count})</span> : null}
          </HeaderLink>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {/*
            The city chip is the only part of the header that reads the URL's
            query string, and `useSearchParams` opts a route out of static
            prerendering unless it sits behind a boundary. Keeping the boundary
            this tight means the rest of the header — logo, nav, the two buttons —
            still renders on the server, and the chip arrives with the same
            markup a moment later.
          */}
          <Suspense fallback={<CityChipFallback />}>
            <CitySelector cities={cities} />
          </Suspense>
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

function HeaderLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
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

/**
 * The chip's own footprint, so the header does not reflow when the real one
 * arrives. It says "Tamil Nadu" rather than nothing because that is what the
 * chip reads for every visitor who has not chosen a city.
 */
function CityChipFallback() {
  return (
    <span className="btn btn-secondary flex items-center gap-[7px]" aria-hidden="true">
      <span className="block h-[14px] w-[5px] bg-(--color-accent)" />
      All of Tamil Nadu <span>▾</span>
    </span>
  );
}

/**
 * DESIGN-SPEC §2.18. Enter/Space opens, arrows move, Esc closes and returns
 * focus to the trigger; an outside click closes it too. One of the three
 * elements in the product that carries a shadow.
 */
function CitySelector({ cities }: { cities: CitiesResponse }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const activeCity = searchParams.get('city') ?? cities.default;
  const cityName =
    cities.data.find((city) => city.slug === activeCity)?.name ?? 'All of Tamil Nadu';
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  function select(slug: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (slug === 'all') next.delete('city');
    else next.set('city', slug);
    next.delete('page');

    const target = pathname === '/' || pathname.startsWith('/cars') ? pathname : '/cars';
    const query = next.toString();
    router.push(query ? `${target}?${query}` : target);
    setOpen(false);
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        ref={triggerRef}
        type="button"
        className="btn btn-secondary flex items-center gap-[7px]"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="block h-[14px] w-[5px] bg-(--color-accent)" aria-hidden="true" />
        {cityName} <span aria-hidden="true">▾</span>
      </button>

      {open ? (
        <div
          id={menuId}
          role="listbox"
          aria-label="Looking for cars in"
          className="absolute right-0 top-[calc(100%+6px)] z-40 w-[220px] border border-(--color-divider) bg-white p-[6px] shadow-[var(--shadow-lg)]"
        >
          <div className="px-[9px] py-[6px] text-[10px] uppercase tracking-[0.1em] ink-subtle">
            Looking for cars in
          </div>
          {cities.data.map((city) => (
            <button
              key={city.slug}
              type="button"
              role="option"
              aria-selected={city.slug === activeCity}
              aria-current={city.slug === activeCity ? 'true' : undefined}
              className="dd-nav-item flex items-center gap-2"
              onClick={() => select(city.slug)}
            >
              <span className="flex-1">{city.name}</span>
              <span className="text-[11px] opacity-60 tnum">{city.count}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
