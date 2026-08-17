'use client';

import type { VehicleCard as VehicleCardDto } from '@dealers-drive/contracts';
import Link from 'next/link';

import { Avatar, ImageSlot, Plate, Tag } from '@/components/ui/primitives';
import { useSavedCars } from '@/features/saved/saved-store';
import { cn } from '@/lib/cn';

/**
 * DESIGN-SPEC §2.8.
 *
 * 4:3 image, year plate top-left, save button top-right, title, price in
 * tabular numerals, a meta row, then a 1px divider and the **dealer strip**.
 * The divider matters: it says "this car belongs to that dealer", and the
 * strip appears on every card without exception. That is the product.
 */
export function VehicleCard({
  vehicle,
  variant = 'grid',
  showSave = true,
}: {
  vehicle: VehicleCardDto;
  variant?: 'grid' | 'compact' | 'list';
  showSave?: boolean;
}) {
  if (variant === 'list') return <VehicleRow vehicle={vehicle} />;

  return (
    <article className="card group relative overflow-hidden p-0">
      <div className="relative aspect-[4/3] border-b border-(--color-divider) bg-(--color-surface)">
        <VehicleImage vehicle={vehicle} sizes="(max-width: 768px) 100vw, 300px" />
        <Plate className="absolute left-[10px] top-[10px] z-[2]">{vehicle.year}</Plate>
        {showSave ? <SaveButton vehicleId={vehicle.id} /> : null}
      </div>

      <div className={cn('flex flex-col p-[12px_13px_14px]', variant === 'compact' ? 'gap-2' : 'gap-[9px]')}>
        <Link
          href={`/car/${vehicle.slug}`}
          className="font-heading text-[16px] font-semibold leading-[1.2] after:absolute after:inset-0 after:content-['']"
        >
          {vehicle.title}
        </Link>

        <div className="flex items-baseline gap-[9px]">
          <span className="text-[20px] font-semibold tnum">{vehicle.priceLabel}</span>
          <span className="text-[11px] ink-subtle tnum">{vehicle.emiLabel}</span>
        </div>

        <div className="flex flex-wrap gap-[6px] text-[11px] ink-muted">
          <span className="tnum">{vehicle.kmLabel}</span>
          <span>·</span>
          <span>{vehicle.fuelLabel}</span>
          <span>·</span>
          <span>{vehicle.transmissionLabel}</span>
          <span>·</span>
          <span>{vehicle.city.name}</span>
        </div>

        {variant === 'compact' ? null : <DealerStrip vehicle={vehicle} />}
      </div>
    </article>
  );
}

function DealerStrip({ vehicle }: { vehicle: VehicleCardDto }) {
  return (
    <div className="flex items-center gap-[7px] border-t border-(--color-divider) pt-[9px]">
      <Avatar initials={vehicle.dealer.initials} size={20} />
      <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-[12px]">
        {vehicle.dealer.brandName}
      </span>
      {vehicle.dealer.isVerified ? (
        <Tag variant="accent" className="relative z-[2] text-[10px]">
          Verified
        </Tag>
      ) : null}
    </div>
  );
}

/** The saved-cars row — 250px fixed image, price right-aligned (§2.8). */
function VehicleRow({ vehicle }: { vehicle: VehicleCardDto }) {
  const { toggle } = useSavedCars();

  return (
    <article className="card flex-row flex-wrap overflow-hidden p-0">
      <div className="relative aspect-[4/3] w-full flex-none border-b border-(--color-divider) bg-(--color-surface) sm:w-[250px] sm:border-b-0 sm:border-r">
        <VehicleImage vehicle={vehicle} sizes="250px" />
        <Plate className="absolute left-[10px] top-[10px] z-[2]">{vehicle.year}</Plate>
      </div>

      <div className="flex min-w-[240px] flex-1 flex-col gap-[10px] p-4">
        <div className="flex flex-wrap items-start gap-3">
          <div className="min-w-0 flex-1">
            <Link href={`/car/${vehicle.slug}`} className="font-heading text-[19px] font-semibold">
              {vehicle.title}
            </Link>
            <div className="mt-1 text-[12px] ink-muted">
              <span className="tnum">{vehicle.kmLabel}</span> · {vehicle.fuelLabel} ·{' '}
              {vehicle.transmissionLabel} · {vehicle.city.name}
            </div>
          </div>
          <div className="text-left sm:text-right">
            <div className="text-[22px] font-semibold tnum">{vehicle.priceLabel}</div>
            <div className="text-[11px] ink-subtle tnum">{vehicle.emiLabel}</div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-(--color-divider) pt-[10px]">
          <Avatar initials={vehicle.dealer.initials} size={22} />
          <span className="text-[12px]">{vehicle.dealer.brandName}</span>
          <Tag variant="accent" className="text-[10px]">
            Verified
          </Tag>
          <Link
            href={`/car/${vehicle.slug}`}
            className="btn btn-primary ml-auto text-[12px]"
          >
            Enquire
          </Link>
          <button
            type="button"
            className="btn btn-secondary text-[12px]"
            onClick={() => toggle(vehicle.id)}
          >
            ♥ Remove
          </button>
        </div>
      </div>
    </article>
  );
}

export function VehicleImage({
  vehicle,
  sizes,
}: {
  vehicle: Pick<VehicleCardDto, 'primaryImage' | 'title' | 'year'>;
  sizes: string;
}) {
  if (!vehicle.primaryImage) {
    return <ImageSlot label={`${vehicle.year} ${vehicle.title}`} />;
  }

  // Plain <img>: the media pipeline already produced the derivatives and the
  // srcset, so next/image would re-optimise bytes that are already optimal.
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={vehicle.primaryImage.url}
      srcSet={vehicle.primaryImage.srcset}
      sizes={sizes}
      alt={vehicle.primaryImage.alt}
      loading="lazy"
      className="h-full w-full object-cover"
    />
  );
}

/**
 * 30×30 on desktop, 44×44 below 768 for the minimum touch target (§4.15).
 * `stopPropagation` so it never opens the VDP, and `aria-pressed` carries the
 * state for anyone not seeing the fill.
 */
function SaveButton({ vehicleId }: { vehicleId: string }) {
  const { isSaved, toggle, hydrated } = useSavedCars();
  const saved = isSaved(vehicleId);

  return (
    <button
      type="button"
      aria-pressed={hydrated ? saved : undefined}
      aria-label={saved ? 'Remove from saved cars' : 'Save this car'}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        toggle(vehicleId);
      }}
      className="absolute right-2 top-2 z-[3] grid h-11 w-11 place-items-center border border-(--color-divider) bg-white text-[14px] leading-none md:h-[30px] md:w-[30px]"
      style={{ color: saved ? 'var(--color-accent)' : 'var(--color-ink)' }}
    >
      {saved ? '♥' : '♡'}
    </button>
  );
}

export function VehicleCardSkeleton() {
  return (
    <div className="card overflow-hidden p-0">
      <div className="aspect-[4/3] border-b border-(--color-divider) bg-(--color-surface)" />
      <div className="flex flex-col gap-[9px] p-[12px_13px_14px]">
        <div className="skeleton w-[70%]" />
        <div className="skeleton w-[46%]" />
        <div className="skeleton w-[88%]" />
        <div className="mt-[9px] border-t border-(--color-divider) pt-[9px]">
          <div className="skeleton w-[60%]" />
        </div>
      </div>
    </div>
  );
}
