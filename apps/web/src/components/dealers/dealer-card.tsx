import type { DealerCard as DealerCardDto } from '@dealers-drive/contracts';
import Link from 'next/link';

import { cn } from '@/lib/cn';

import { ImageSlot, LogoTile, Plate, Tag } from '@/components/ui/primitives';

const CARD_HEIGHT = 'h-[400px]';

const COVER_HEIGHT = 'h-[128px]';
const TILE_SIZE = 48;

export function DirectoryCard({ dealer }: { dealer: DealerCardDto }) {
  return (
    <article
      className={cn(
        'card group relative gap-0 overflow-hidden p-0',
        'transition-colors duration-150 hover:border-(--color-accent)',
        CARD_HEIGHT,
      )}
    >
      <div
        className={cn(
          'relative w-full shrink-0 overflow-hidden border-b border-(--color-divider) bg-(--color-surface)',
          COVER_HEIGHT,
        )}
      >
        {dealer.coverUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={dealer.coverUrl} alt="" className="h-full w-full object-cover" />
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-linear-to-t from-black/40 via-transparent to-transparent"
            />
          </>
        ) : (
          <ImageSlot label={`${dealer.brandName} — yard photo`} />
        )}

        {dealer.isVerified ? (
          <span className="absolute right-[10px] top-[10px] bg-ink/75 px-[7px] py-[2px] font-mono text-[10px] tracking-[0.08em] text-white backdrop-blur-[2px]">
            YARD VERIFIED
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col px-[18px] pb-[14px]">
        <div
          className="relative mb-[12px] flex items-end justify-between gap-2"
          style={{ marginTop: -TILE_SIZE / 2 }}
        >
          <LogoTile
            initials={dealer.initials}
            size={TILE_SIZE}
            className="border-(--color-ink) bg-white"
          />
          {dealer.isVerified ? (
            <Plate size="chip" className="bg-white">
              VERIFIED DEALER
            </Plate>
          ) : null}
        </div>

        <h3 className="line-clamp-2 font-heading text-[17px] font-semibold leading-[1.2]">
          <Link href={`/dealers/${dealer.slug}`} className="after:absolute after:inset-0">
            {dealer.brandName}
          </Link>
        </h3>
        <div className="mt-[3px] text-[12px] ink-subtle tnum">{dealer.yearsLabel}</div>

        <div
          data-slot="prose"
          className="mt-[10px] flex min-h-0 flex-1 flex-col gap-[10px] overflow-hidden"
        >
          {dealer.tagline ? (
            <div className="shrink-0 border-l-2 border-(--color-accent) bg-(--color-neutral-100) px-[10px] py-[10px]">
              <p className="line-clamp-2 text-[12px] leading-[1.5] ink-secondary">
                <span aria-hidden="true">“</span>
                {dealer.tagline}
                <span aria-hidden="true">”</span>
              </p>
            </div>
          ) : null}

          {dealer.services.length > 0 ? (
            <div className="flex shrink-0 flex-wrap gap-[6px]">
              {dealer.services.slice(0, 3).map((service, index) => (
                <Tag
                  key={service}
                  variant={index === 0 ? 'accent' : 'neutral'}
                  className={cn(
                    'border text-[10px]',
                    index === 0 ? 'border-(--color-accent-200)' : 'border-(--color-neutral-200)',
                  )}
                >
                  {service}
                </Tag>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-auto flex items-baseline gap-3 border-t border-(--color-divider) bg-neutral-100/60 px-[18px] py-[10px]">
        <span className="whitespace-nowrap text-[13px] font-semibold tnum">
          {dealer.carCount} {dealer.carCount === 1 ? 'car' : 'cars'} listed
        </span>
        <span className="whitespace-nowrap text-[12px] ink-subtle tnum">
          {dealer.fromPriceLabel}
        </span>
        <span className="btn btn-ghost ml-auto text-[12px]">
          View inventory{' '}
          <span aria-hidden="true" className="transition-transform group-hover:translate-x-[2px]">
            →
          </span>
        </span>
      </div>
    </article>
  );
}
