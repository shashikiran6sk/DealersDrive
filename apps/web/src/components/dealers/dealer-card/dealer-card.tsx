import type { DealerCard as DealerCardDto } from '@dealers-drive/contracts';
import Link from 'next/link';

import { LogoTile, Plate, Tag } from '@/components/ui/primitives';
import { cn } from '@/lib/cn';

import { DealerCardCover } from './dealer-card-cover';
import { DealerCardFooter } from './dealer-card-footer';
import { CARD_HEIGHT, DEALER_CARD_TEXT, SERVICES_SHOWN, TILE_SIZE } from './dealer-card.constants';

/**
 * DESIGN-SPEC §3.5 — the directory card.
 *
 * A 128px cover band, then an identity plate row that straddles its bottom edge,
 * then the dealership's own words, then a footer pinned to the bottom.
 *
 * The whole card is the link to the portfolio; "View inventory →" is an
 * affordance, not a second destination, so it is not a nested anchor — the
 * heading's link is stretched over the card with `after:absolute after:inset-0`
 * and everything below stays *underneath* that overlay (**R29**).
 *
 * **The plate row is its own row (R28).** The tile used to sit on the heading's
 * flex line, bottom-aligned to a block whose height the name set, so a name
 * wrapping to two lines dragged the logo 21px down the card (**R24**). Its
 * position is now fixed against the *cover*, so no length of name can move it —
 * R24's failure is structurally unavailable rather than corrected. The name also
 * gets the card's full width, wrapping at 254px rather than 120.
 *
 * **The card is one fixed size.** `CARD_HEIGHT` is a hard height and the card's
 * job is to fit inside it: the name and tagline are clamped to two lines, and the
 * prose region flexes and clips so a two-row tag wrap eats slack rather than
 * height. A sparse dealership leaves that slack empty — that empty space *is* the
 * fixed size. R17's `min-h` made every card match the tallest one, which is a
 * shared variable size rather than a fixed one.
 *
 * ⚠️ The file is `dealer-card` and the export is **`DirectoryCard`**.
 * `DealerCard` is the *contracts type* it takes (finding D-6).
 */
export function DirectoryCard({ dealer }: { dealer: DealerCardDto }) {
  return (
    <article
      className={cn(
        'card group relative gap-0 overflow-hidden p-0',
        // §2.7 is explicit that a card is "a border, never a shadow", so the
        // whole card lifting on hover is not available here however common it is
        // elsewhere — the border taking the accent is the same signal in the
        // system's own vocabulary.
        'transition-colors duration-150 hover:border-(--color-accent)',
        CARD_HEIGHT,
      )}
    >
      <DealerCardCover dealer={dealer} />

      <div className="flex flex-1 flex-col px-[18px] pb-[14px]">
        {/*
          The identity plate row (**R28**). `items-end` is safe here in a way it
          was not in R24: both children are fixed-size and neither one's height
          depends on the dealership's data. Pulled up by half the tile, so its
          height contribution below the cover is 24px rather than 48.
        */}
        <div
          /*
           * `relative` without a `z-index` (**R29**). It has to be positioned or
           * it paints under the cover instead of straddling it; it must not be
           * lifted, because `z-[2]` put it over the heading's stretched overlay
           * and made the 24px band a dead strip across the top of the card.
           */
          className="relative mb-[12px] flex items-end justify-between gap-2"
          style={{ marginTop: -TILE_SIZE / 2 }}
        >
          <LogoTile
            initials={dealer.initials}
            size={TILE_SIZE}
            // A white chip with an ink hairline rather than the accent-tinted
            // square it is elsewhere: it sits half on a photograph, and the tint
            // has nothing to separate it from a blue-grey forecourt.
            className="border-(--color-ink) bg-white"
          />
          {dealer.isVerified ? (
            <Plate size="chip" className="bg-white">
              {DEALER_CARD_TEXT.verifiedDealer}
            </Plate>
          ) : null}
        </div>

        {/* Two lines at most (R21) — a long registered name is the biggest
            variable on the card, and four lines of it would push the tagline and
            the tags out of the frame entirely. */}
        <h3 className="line-clamp-2 font-heading text-[17px] font-semibold leading-[1.2]">
          <Link href={`/dealers/${dealer.slug}`} className="after:absolute after:inset-0">
            {dealer.brandName}
          </Link>
        </h3>
        {/* Already reads "Vellore, Tamil Nadu · 7 years" — one API-composed line. */}
        <div className="mt-[3px] text-[12px] ink-subtle tnum">{dealer.yearsLabel}</div>

        {/*
          Where the card's slack lives (R21). `min-h-0` is what lets a flex child
          shrink below its content — without it `overflow-hidden` never engages
          and the box pushes the footer down instead.
        */}
        <div
          data-slot="prose"
          className="mt-[10px] flex min-h-0 flex-1 flex-col gap-[10px] overflow-hidden"
        >
          {dealer.tagline ? (
            /*
             * The pledge panel (**R28**) — the dealership's own sentence, set
             * apart from the card's voice by a tint and an accent rule. The
             * quotation marks are decorative: they make the sentence read as
             * quoted, and an announced "left double quotation mark" before every
             * tagline in a directory of eighteen is noise.
             *
             * `shrink-0` here and on the tag row: a flex child shrinks before its
             * parent clips, and a squeezed tag row cuts the bottom off its second
             * line of chips.
             */
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
                  /*
                   * The **first** chip takes the accent (**R29**). R28 accented
                   * the third because that is what the UI reference draws, but
                   * the chip row is read left to right and the accent is the
                   * eye's entry point — landing it last puts the highlight after
                   * the reader has already read the row. `index === 0` also
                   * degrades in the direction the data goes: every dealership
                   * with one service has one, so the row reads the same whether a
                   * yard listed one service or twelve.
                   */
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
