import Link from 'next/link';

import { LinkPendingLabel } from '@/components/ui/link-pending';
import { VehicleCard } from '@/components/vehicle/vehicle-card';
import { HOME_TEXT } from '@/features/home/home.constants';

import type { DiscoveryRowProps } from './discovery-row.types';

export function DiscoveryRow({ id, title, href, cars }: DiscoveryRowProps) {
  if (cars.length === 0) return null;

  return (
    <section aria-labelledby={`${id}-heading`} className="flex flex-col gap-[14px]">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id={`${id}-heading`} className="text-[22px] sm:text-[24px]">
          {title}
        </h2>
        <Link href={href} className="relative btn btn-ghost text-[13px]">
          <LinkPendingLabel>{HOME_TEXT.viewAll}</LinkPendingLabel>
        </Link>
      </div>
      <div
        role="group"
        aria-labelledby={`${id}-heading`}
        tabIndex={0}
        className="grid items-stretch gap-[18px] [grid-template-columns:repeat(auto-fill,minmax(262px,1fr))] max-md:flex max-md:gap-3 max-md:overflow-x-auto max-md:pb-2 max-md:snap-x max-md:snap-proximity max-md:[&>article]:w-[min(280px,85vw)] max-md:[&>article]:flex-none max-md:[&>article]:snap-start"
      >
        {cars.map((car) => (
          <VehicleCard key={car.slug} vehicle={car} />
        ))}
      </div>
    </section>
  );
}
