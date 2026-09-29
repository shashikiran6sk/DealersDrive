import type { DealerCard as DealerCardDto } from '@dealers-drive/contracts';
import Link from 'next/link';

import { LogoTile, Plate, Tag } from '@/components/ui/primitives';
import { cn } from '@/lib/cn';

import { DealerCardCover } from './dealer-card-cover';
import { DealerCardFooter } from './dealer-card-footer';
import { CARD_HEIGHT, DEALER_CARD_TEXT, SERVICES_SHOWN, TILE_SIZE } from './dealer-card.constants';

export function DirectoryCard({ dealer }: { dealer: DealerCardDto }) {
  return (
    <article
      className={cn(
        'card group relative gap-0 overflow-hidden rounded-[16px] p-0 shadow-sm',
        'transition-[border-color,box-shadow] duration-150 hover:border-(--color-neutral-400) hover:shadow-md',
        'has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-(--color-focus)',
        CARD_HEIGHT,
      )}
    >
      <DealerCardCover dealer={dealer} />

      <div className="flex min-h-0 flex-1 flex-col px-[18px] pb-[14px]">
        <div
          className="relative mb-[10px] flex items-end justify-between gap-2"
          style={{ marginTop: -TILE_SIZE / 2 }}
        >
          <LogoTile initials={dealer.initials} size={TILE_SIZE} className="bg-white shadow-sm" />
          {dealer.isVerified ? (
            <Plate size="chip" className="bg-white">
              {DEALER_CARD_TEXT.verifiedDealer}
            </Plate>
          ) : null}
        </div>

        <h3 className="line-clamp-2 font-heading text-[17px] font-extrabold leading-[1.25] tracking-[-0.02em]">
          <Link
            href={`/dealers/${dealer.slug}`}
            className="after:absolute after:inset-0 focus-visible:outline-none"
          >
            {dealer.brandName}
          </Link>
        </h3>
        <div className="mt-[3px] truncate text-[12px] ink-muted tnum">{dealer.yearsLabel}</div>

        <div
          data-slot="prose"
          className="mt-[12px] flex min-h-0 flex-1 flex-col gap-[10px] overflow-hidden"
        >
          {dealer.services.length > 0 ? (
            <div className="flex shrink-0 flex-wrap gap-[6px]">
              {dealer.services.slice(0, SERVICES_SHOWN).map((service, index) => (
                <Tag
                  key={service}
                  variant={index === 0 ? 'accent' : 'neutral'}
                  className="max-w-full truncate text-[11px]"
                >
                  {service}
                </Tag>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <DealerCardFooter dealer={dealer} />
    </article>
  );
}
