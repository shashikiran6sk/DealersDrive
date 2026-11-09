import Link from 'next/link';

import { VehicleImage, vehicleHref } from '@/components/vehicle/vehicle-card';

import { CategoryIcon } from './category-icon';
import type { CategoryCarsProps } from './category-deck.types';

export function CategoryCars({ category }: CategoryCarsProps) {
  const [lead, ...rest] = category.cars;

  if (!lead) {
    return (
      <div className="flex h-full min-h-[180px] flex-col items-center justify-center gap-4 p-8 text-center">
        <CategoryIcon
          icon={category.icon}
          className="h-[60px] w-[120px] text-(--color-neutral-500)"
        />
        <p className="max-w-[36ch] text-[13px] leading-[1.6] ink-muted">{category.emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-2.5 p-2.5 md:p-3.5">
      <Link
        href={vehicleHref(lead.slug)}
        className="dd-deck-photo group relative flex min-h-0 flex-1 items-center justify-center rounded-[18px]"
      >
        <div className="h-[160px] w-full md:h-[300px]">
          <VehicleImage
            image={lead.image}
            className="object-contain mix-blend-darken transition-transform duration-500 group-hover:scale-[1.03]"
          />
        </div>
        <span className="absolute bottom-1.5 left-2 flex max-w-[calc(100%-16px)] gap-1.5 truncate rounded-full bg-white px-3 py-1.5 text-[12px] font-bold shadow-sm">
          <span className="truncate">{lead.title}</span>
          {lead.priceLabel ? <span className="tnum ink-muted">{lead.priceLabel}</span> : null}
        </span>
      </Link>
      {rest.length > 0 ? (
        <div className="grid gap-2.5 max-md:hidden sm:grid-cols-2">
          {rest.map((car) => (
            <Link
              key={car.slug}
              href={vehicleHref(car.slug)}
              className="flex min-w-0 items-center gap-2.5 rounded-[14px] bg-white p-2 transition-transform duration-200 hover:-translate-y-0.5"
            >
              <div className="aspect-[4/3] w-[72px] flex-none overflow-hidden rounded-[8px] bg-(--color-neutral-150)">
                <VehicleImage image={car.image} />
              </div>
              <div className="min-w-0 text-[12px] leading-[1.4]">
                <div className="truncate font-bold">{car.title}</div>
                {car.priceLabel ? <div className="tnum ink-muted">{car.priceLabel}</div> : null}
              </div>
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
