import type { DealerCard as DealerCardDto } from '@dealers-drive/contracts';
import Link from 'next/link';

import { cn } from '@/lib/cn';

import { Blueprint, ImageSlot, LogoTile, Plate, Tag } from '@/components/ui/primitives';

/**
 * The card, to the pixel (**R21**).
 *
 * Sized for the fullest card the API can produce, so that the fullest one is
 * the one that *fits* rather than the one that sets the height for everybody.
 * The worst case is a long registered name over two lines, a tagline over two,
 * and three services that wrap to a second row — all three at once, which is an
 * ordinary Indian dealership with a complete profile:
 *
 * ```
 *   104  cover
 *     1  its bottom divider
 *    10  the gap below it
 *    28  body padding, 14 top and bottom
 *    63  identity — two lines of name (41) + 3 + the place-and-tenure line (19)
 *    10  gap
 *    36  tagline, two lines at 12px/1.5
 *    10  gap
 *    49  tags, two rows of 21.5 with a 6px gap between them
 *    10  gap
 *    31  footer — 1px rule + 10 padding + a 13px line
 *   ---
 *   362  and the borders
 *   + 6  headroom
 *   ---
 *   368
 * ```
 *
 * The arithmetic is here to be argued with, but it is not what the number was
 * chosen by: the `Fullest` sandbox story renders all three maxima at once and
 * was measured. At 362 it fitted with **zero** headroom — the last row of tags
 * ending exactly on the box's bottom edge — so the six extra pixels are there
 * because line heights round and a font substitution moves all of this by one
 * or two. Clipping here is silent, and what it eats first is half a row of
 * chips.
 *
 * A card with a one-line name and nothing optional filled in spends about 140
 * of those on white space above the footer. That is what a fixed size *costs*,
 * and it is worth paying here: a directory reads as a grid, and a grid whose
 * cells change proportion with their contents does not.
 */
const CARD_HEIGHT = 'h-[368px]';

/**
 * DESIGN-SPEC §3.5 — the directory card.
 *
 * A 104px blueprint cover, then a body whose 44px logo tile sits at the top of
 * the identity block, level with the first line of the name whether the name
 * runs to one line or two (**R24** — see the note at the tile itself for what
 * the `-34px` in the spec was actually doing).
 *
 * The whole card is the link to the portfolio; the inner
 * "View inventory →" is an affordance, not a second destination, so it is not a
 * nested anchor — the heading's link is stretched over the card with
 * `after:absolute after:inset-0` and the affordance is lifted above it.
 *
 * ## The card is one fixed size (R21)
 *
 * `CARD_HEIGHT` is a hard height, not a floor. **R17** made every card in the
 * grid match every other, with `min-h` underneath and `grid-auto-rows: 1fr` on
 * the grid — and that was the wrong shape of answer. Cards matched each other,
 * but the size they all agreed on was the tallest card's, so writing a longer
 * tagline or adding a third service still made every card on the page taller.
 * A directory that changes proportion as its dealerships fill in their
 * profiles is not a fixed size; it is a shared variable one.
 *
 * So the height is a constant, and the card's job is to fit inside it:
 *
 *   · **The name is clamped to two lines.** Indian dealership names run long —
 *     "Sri Venkateswara Automobiles and Finance Private Limited" is four lines
 *     at this width — and an unclamped heading is the largest variable on the
 *     card.
 *   · **The tagline is clamped to two lines**, as it has been since R17.
 *   · **The prose region flexes and clips.** The tagline and the tags sit in a
 *     `flex-1 min-h-0 overflow-hidden` box, so a two-row tag wrap eats slack
 *     rather than height, and a sparse dealership leaves the slack empty. That
 *     empty space *is* the fixed size — it is what "the card does not shrink"
 *     means when there is nothing to put in it.
 *
 * The footer stays pinned to the bottom edge either way, which is what makes
 * the blank read as a card with room in it rather than as a card cut short.
 *
 * Nothing reserves an empty box: with no tagline there is no paragraph, and
 * with no services there is no tag row. The height comes from the container,
 * so a screen reader has nothing extra to announce.
 *
 * ⚠️ The file is `dealer-card.tsx` and the export is **`DirectoryCard`**.
 * `DealerCard` is the *contracts type* it takes (finding D-6), and the sandbox
 * registry's `aliases` field exists so that somebody searching for either name
 * finds this component rather than writing a second one.
 */
export function DirectoryCard({ dealer }: { dealer: DealerCardDto }) {
  return (
    <article className={cn('card relative gap-[10px] overflow-visible p-0', CARD_HEIGHT)}>
      <Blueprint className="h-[104px] border-b border-(--color-divider) bg-(--color-surface)">
        {dealer.coverUrl ? (
          /*
           * The dealership's own yard photograph, cropped to the band.
           *
           * `alt=""` on purpose: the card's heading already names the
           * dealership, and the image carries nothing a buyer would lose — a
           * screen reader announcing "Annamalai Auto Mart — yard photo" right
           * before the link that says "Annamalai Auto Mart" is noise.
           *
           * A plain `<img>` rather than `next/image` because the bytes come
           * from `MEDIA_BASE_URL`, which is the API's own origin in every
           * environment and a CDN host in production — configuring
           * `remotePatterns` for a host that moves per environment trades a
           * build-time constant for a runtime 400.
           */
          // eslint-disable-next-line @next/next/no-img-element
          <img src={dealer.coverUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          /*
           * A dealership that has not uploaded one — or whose upload is still
           * being processed. The slot names the shot rather than showing a grey
           * rectangle, which is what makes the gap read as pending rather than
           * broken.
           */
          <ImageSlot label={`${dealer.brandName} — yard photo`} />
        )}
      </Blueprint>

      <div className="flex flex-1 flex-col gap-[10px] p-[14px]">
        {/*
          The tile sits at the top of the identity block, beside the first line
          of the name — and stays there however long the name is (**R24**).

          It was `items-end` with a `-mt-[34px]` on the tile, which read as "pull
          the tile up over the cover's divider" and did nothing of the sort. A
          negative margin-top does not move a flex item that is aligned to the
          *bottom* of its line; all it did was shrink the tile's contribution to
          the line height, which the taller identity block set anyway. What the
          card actually rendered was a tile whose bottom edge tracked the bottom
          of the name-and-place block — so a dealership whose name wrapped to two
          lines got its logo pushed 21px down the card, level with the second
          word instead of the first.

          `items-start` pins it instead, and the `-mt-[3px]` is what the
          one-line case already measured: with a single-line name the block is
          41.4px tall (20.4 of heading + 3 + the 18px place line) and the
          bottom-aligned tile's top edge landed at -2.6px. So a short name looks
          exactly as it did, and a long one no longer drags the tile with it.
        */}
        <div className="flex items-start gap-[10px]">
          <LogoTile initials={dealer.initials} size={44} className="relative z-[2] -mt-[3px]" />
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-2">
              {/* Two lines at most (R21). A long registered name is the biggest
                  variable on the card, and four lines of it would push the
                  tagline and the tags out of the frame entirely. */}
              <h3 className="line-clamp-2 min-w-0 flex-1 font-heading text-[17px] font-semibold leading-[1.2]">
                <Link href={`/dealers/${dealer.slug}`} className="after:absolute after:inset-0">
                  {dealer.brandName}
                </Link>
              </h3>
              {dealer.isVerified ? <Plate size="chip">VERIFIED</Plate> : null}
            </div>
            {/* Already reads "Vellore, Tamil Nadu · 7 years" — one API-composed line. */}
            <div className="mt-[3px] text-[12px] ink-subtle tnum">{dealer.yearsLabel}</div>
          </div>
        </div>

        {/*
          The prose, in a box that flexes and clips (R21).

          This is where the card's slack lives. A dealership with a two-line
          tagline and three services that wrap to two rows fills it; one that
          finished onboarding an hour ago leaves it empty; neither changes the
          height of the card or of any card beside it. `min-h-0` is what lets a
          flex child shrink below its content — without it `overflow-hidden`
          never engages and the box pushes the footer down instead.
        */}
        <div className="flex min-h-0 flex-1 flex-col gap-[10px] overflow-hidden">
          {/* Two lines at most, so that one verbose dealership cannot spend the
              whole box (R17). */}
          {/* `shrink-0` on both: a flex child shrinks before its parent clips,
              and a squeezed tag row cuts the bottom off its second line of
              chips. They keep their natural height and the box clips instead —
              which it never has to, because `CARD_HEIGHT` is sized for the
              fullest of them. */}
          {dealer.tagline ? (
            <p className="line-clamp-2 shrink-0 text-[12px] leading-[1.5] ink-secondary">
              {dealer.tagline}
            </p>
          ) : null}

          {dealer.services.length > 0 ? (
            <div className="flex shrink-0 flex-wrap gap-[6px]">
              {dealer.services.slice(0, 3).map((service) => (
                <Tag key={service} className="text-[10px]">
                  {service}
                </Tag>
              ))}
            </div>
          ) : null}
        </div>

        {/* `mt-auto` is belt and braces now that the box above it is `flex-1`:
            the footer is pinned to the bottom edge whether the card is full or
            almost empty, which is what makes the slack read as room rather
            than as a card cut short. */}
        <div className="mt-auto flex items-baseline gap-3 border-t border-(--color-divider) pt-[10px]">
          <span className="whitespace-nowrap text-[13px] font-semibold tnum">
            {dealer.carCount} {dealer.carCount === 1 ? 'car' : 'cars'} listed
          </span>
          <span className="whitespace-nowrap text-[12px] ink-subtle tnum">
            {dealer.fromPriceLabel}
          </span>
          <span className="btn btn-ghost relative z-[2] ml-auto text-[12px]">View inventory →</span>
        </div>
      </div>
    </article>
  );
}
