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
        'card group relative gap-0 overflow-hidden p-0',
        'transition-colors duration-150 hover:border-(--color-accent)',
        CARD_HEIGHT,
      )}
    >
      <DealerCardCover dealer={dealer} />

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
              {DEALER_CARD_TEXT.verifiedDealer}
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
                <span aria-hidden="true">{DEALER_CARD_TEXT.openQuote}</span>
                {dealer.tagline}
                <span aria-hidden="true">{DEALER_CARD_TEXT.closeQuote}</span>
              </p>
            </div>
          ) : null}

          {dealer.services.length > 0 ? (
            <div className="flex shrink-0 flex-wrap gap-[6px]">
              {dealer.services.slice(0, SERVICES_SHOWN).map((service, index) => (
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

      <DealerCardFooter dealer={dealer} />
    </article>
  );
}
