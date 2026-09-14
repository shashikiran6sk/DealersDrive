'use client';

import type { PublicLocations } from '@dealers-drive/contracts';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Suspense, type ReactNode } from 'react';

import { LocationSelector } from '@/components/layout/location-selector';
import { Plate } from '@/components/ui/primitives';
import { cn } from '@/lib/cn';

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
          <Suspense fallback={<LocationChipFallback />}>
            <LocationSelector locations={locations} />
          </Suspense>
          <Link href="/dealer" className="btn btn-primary">
            <span className="hidden lg:inline">Dealer login</span>
            <span className="lg:hidden">Login</span>
          </Link>
        </div>
      </div>
    </header>
  );
}

function LocationChipFallback() {
  return (
    <span className="btn btn-secondary flex items-center gap-[7px]" aria-hidden="true">
      <span className="block h-[14px] w-[5px] bg-(--color-accent)" />
      Select district <span>▾</span>
    </span>
  );
}

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
