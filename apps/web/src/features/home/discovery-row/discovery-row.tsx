import Link from 'next/link';

import { VehicleCard } from '@/components/vehicle/vehicle-card';
import { HOME_TEXT } from '@/features/home/home.constants';

import type { DiscoveryRowProps } from './discovery-row.types';

export function DiscoveryRow({ id, title, href, total, cars }: DiscoveryRowProps) {
  if (cars.length === 0) return null;

  return (
    <section aria-labelledby={`${id}-heading`} className="flex flex-col gap-[14px]">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id={`${id}-heading`} className="text-[24px] sm:text-[28px]">
          {title}
        </h2>
        <Link href={href} className="btn btn-ghost">
          {HOME_TEXT.viewAll(total)}
        </Link>
      </div>
      <div className="grid gap-[18px] [grid-template-columns:repeat(auto-fill,minmax(262px,1fr))]">
        {cars.map((car) => (
          <VehicleCard key={car.slug} vehicle={car} />
        ))}
      </div>
    </section>
  );
}
