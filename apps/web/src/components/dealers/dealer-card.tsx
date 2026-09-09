import type { DealerCard as DealerCardDto } from '@dealers-drive/contracts';
import Link from 'next/link';

import { cn } from '@/lib/cn';

import { ImageSlot, LogoTile, Plate, Tag } from '@/components/ui/primitives';

/**
 * The card, to the pixel (**R21**, re-derived for **R28**).
 *
 * Sized for the fullest card the API can produce, so that the fullest one is
 * the one that *fits* rather than the one that sets the height for everybody.
 * The worst case is a long registered name over two lines, a tagline over two,
 * and three services that wrap to a second row — all three at once, which is an
 * ordinary Indian dealership with a complete profile.
 *
 * **R21 arrived at 368 by measuring, not by adding up**, and said so: it
 * rendered the `Fullest` story, found the last row of chips ending exactly on
 * the box's bottom edge at 362, and added six for rounding. So this number is
 * not re-derived from scratch either. It is 368 plus the three changes R28
 * makes to the card's vertical stack, each of which is exact, and with every
 * unchanged part — the two-line name, the place line, the tag rows, the footer
 * — cancelling out of the sum:
 *
 * ```
 *   368  the measured R21 height
 *   +24  a taller cover — 104 → 128
 *   +12  the plate row, which is new
 *          the tile is 48 pulled up 24, so it costs 24 below the cover, plus a
 *          12px gap under it — and it replaces the 10px card gap and the 14px
 *          body padding that used to sit there, so 36 − 24 = 12
 *   +20  the pledge panel's own padding — the tagline is 36 either way, but it
 *          is now inside 10px top and bottom
 *   ---
 *   424
 * ```
 *
 * The identity block, the prose gaps, the tag rows and the footer are all
 * untouched, so R21's six pixels of headroom survive intact — which is the
 * point of doing it as a delta. `Fullest` is still the story that would show it
 * if a font substitution ate them: clipping here is silent, and what it eats
 * first is half a row of chips.
 *
 * A card with a one-line name and nothing optional filled in spends about 150
 * of those on white space above the footer. That is what a fixed size *costs*,
 * and it is worth paying here: a directory reads as a grid, and a grid whose
 * cells change proportion with their contents does not.
 */
const CARD_HEIGHT = 'h-[424px]';

/** The cover band, and the distance the logo tile is pulled up over it. */
const COVER_HEIGHT = 'h-[128px]';
const TILE_SIZE = 48;

/**
 * DESIGN-SPEC §3.5 — the directory card.
 *
 * A 128px cover band, then an identity plate row that straddles its bottom
 * edge, then the dealership's own words, then a footer pinned to the bottom.
 *
 * The whole card is the link to the portfolio; the inner
 * "View inventory →" is an affordance, not a second destination, so it is not a
 * nested anchor — the heading's link is stretched over the card with
 * `after:absolute after:inset-0` and the affordance is lifted above it.
 *
 * ## R28 — the plate row is its own row
 *
 * The logo tile used to sit *inside* the identity block, on the same flex line
 * as the heading, which is what made **R24** a bug worth fixing: the tile was
 * bottom-aligned to a block whose height the name set, so a name that wrapped
 * to two lines dragged the logo 21px down the card.
 *
 * It is not in that row any more. The tile and the VERIFIED DEALER plate share
 * a row of their own, pulled up over the cover's bottom edge by half the tile,
 * and the name starts underneath both. The tile's position is therefore fixed
 * against the *cover* rather than against the name, and no length of dealership
 * name can move it — R24's failure is structurally unavailable rather than
 * corrected, which is the better shape of fix and the reason the R24 test now
 * asserts the separation rather than the alignment.
 *
 * The plate moving out of the heading row buys the second thing: the name gets
 * the full width of the card instead of whatever the plate left it, so a
 * registered name wraps at 254px rather than at 120.
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
 *   · **The prose region flexes and clips.** The pledge and the tags sit in a
 *     `flex-1 min-h-0 overflow-hidden` box, so a two-row tag wrap eats slack
 *     rather than height, and a sparse dealership leaves the slack empty. That
 *     empty space *is* the fixed size — it is what "the card does not shrink"
 *     means when there is nothing to put in it.
 *
 * The footer stays pinned to the bottom edge either way, which is what makes
 * the blank read as a card with room in it rather than as a card cut short.
 *
 * Nothing reserves an empty box: with no tagline there is no pledge panel, and
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
    <article
      className={cn(
        'card group relative gap-0 overflow-hidden p-0',
        // The one hover the card has. §2.7 is explicit that a card is "a border,
        // never a shadow", so the whole card lifting on hover is not available
        // here however common it is elsewhere — the border taking the accent is
        // the same signal in the system's own vocabulary.
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
            {/*
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
             */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={dealer.coverUrl} alt="" className="h-full w-full object-cover" />
            {/*
             * A wash into the bottom edge, so the white logo tile that straddles
             * that edge has something to sit against. A yard photograph is
             * whatever the dealer's phone saw — often a bright forecourt — and
             * a white tile on white sky is the one place the overlap stops
             * reading as an overlap. Only over a photograph: the `ImageSlot`
             * below is a flat panel that needs no help and would only be
             * dirtied by it.
             */}
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-linear-to-t from-black/40 via-transparent to-transparent"
            />
          </>
        ) : (
          /*
           * A dealership that has not uploaded one — or whose upload is still
           * being processed. The slot names the shot rather than showing a grey
           * rectangle, which is what makes the gap read as pending rather than
           * broken.
           */
          <ImageSlot label={`${dealer.brandName} — yard photo`} />
        )}

        {/*
          The audit mark, over the corner of the cover.

          It says what the plate below it says, in the place a buyer looks
          first — the photograph is the thing that could be anybody's forecourt,
          and the mark is what says this one was stood in. There is no year on
          it: nothing on the platform records when a yard was audited, and a
          date the product cannot stand behind is worse than no date.
        */}
        {dealer.isVerified ? (
          <span className="absolute right-[10px] top-[10px] bg-ink/75 px-[7px] py-[2px] font-mono text-[10px] tracking-[0.08em] text-white backdrop-blur-[2px]">
            YARD VERIFIED
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col px-[18px] pb-[14px]">
        {/*
          The identity plate row, straddling the cover's bottom edge (**R28**).

          `items-end` is safe here in a way it was not in R24: the two children
          are a fixed-size tile and a single-line plate, and neither one's height
          depends on the dealership's data. The row is pulled up by half the
          tile, so the tile's top half is over the cover and its bottom half is
          over the body — which is the whole point of it, and is why the row's
          height contribution below the cover is 24px rather than 48.
        */}
        <div
          className="relative z-[2] mb-[12px] flex items-end justify-between gap-2"
          style={{ marginTop: -TILE_SIZE / 2 }}
        >
          <LogoTile
            initials={dealer.initials}
            size={TILE_SIZE}
            // The tile is a white chip with an ink hairline here rather than the
            // accent-tinted square it is elsewhere: it sits half on a
            // photograph, and the tinted fill has nothing to separate it from a
            // blue-grey forecourt. White against ink does.
            className="border-(--color-ink) bg-white"
          />
          {dealer.isVerified ? (
            <Plate size="chip" className="bg-white">
              VERIFIED DEALER
            </Plate>
          ) : null}
        </div>

        {/* Two lines at most (R21). A long registered name is the biggest
            variable on the card, and four lines of it would push the tagline
            and the tags out of the frame entirely. It has the full width of the
            card now that the plate is in its own row above. */}
        <h3 className="line-clamp-2 font-heading text-[17px] font-semibold leading-[1.2]">
          <Link href={`/dealers/${dealer.slug}`} className="after:absolute after:inset-0">
            {dealer.brandName}
          </Link>
        </h3>
        {/* Already reads "Vellore, Tamil Nadu · 7 years" — one API-composed line. */}
        <div className="mt-[3px] text-[12px] ink-subtle tnum">{dealer.yearsLabel}</div>

        {/*
          The prose, in a box that flexes and clips (R21).

          This is where the card's slack lives. A dealership with a two-line
          tagline and three services that wrap to two rows fills it; one that
          finished onboarding an hour ago leaves it empty; neither changes the
          height of the card or of any card beside it. `min-h-0` is what lets a
          flex child shrink below its content — without it `overflow-hidden`
          never engages and the box pushes the footer down instead.
        */}
        <div
          data-slot="prose"
          className="mt-[10px] flex min-h-0 flex-1 flex-col gap-[10px] overflow-hidden"
        >
          {/* Two lines at most, so that one verbose dealership cannot spend the
              whole box (R17). */}
          {/* `shrink-0` on both: a flex child shrinks before its parent clips,
              and a squeezed tag row cuts the bottom off its second line of
              chips. They keep their natural height and the box clips instead —
              which it never has to, because `CARD_HEIGHT` is sized for the
              fullest of them. */}
          {dealer.tagline ? (
            /*
             * The pledge panel (**R28**) — the dealership's own sentence, set
             * apart from the card's own voice by a tint and an accent rule.
             *
             * The quotation marks are `aria-hidden` and decorative. They are
             * what makes the sentence read as *quoted* rather than as the
             * product describing the dealer, and a screen reader gets the
             * sentence without them: an announced "left double quotation mark"
             * before every tagline in a directory of eighteen is noise, and the
             * tint and rule carry nothing for it to lose.
             */
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
                  /*
                   * The third chip takes the accent, as the reference draws it.
                   * It is a focal point rather than a claim — nothing makes a
                   * dealership's third service more important than its first —
                   * so it is keyed to the *position* and not to the value, and
                   * a dealership offering one or two services gets a row of
                   * plain chips rather than a lone highlighted one.
                   */
                  variant={index === 2 ? 'accent' : 'neutral'}
                  className={cn(
                    'border text-[10px]',
                    index === 2 ? 'border-(--color-accent-200)' : 'border-(--color-neutral-200)',
                  )}
                >
                  {service}
                </Tag>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {/* `mt-auto` is belt and braces now that the box above it is `flex-1`:
          the footer is pinned to the bottom edge whether the card is full or
          almost empty, which is what makes the slack read as room rather
          than as a card cut short.

          It runs to the card's own edges rather than sitting inside the body's
          padding (**R28**), and takes a tint off the ground colour — which is
          what makes it read as the card's base rather than as the last row of
          its content. */}
      <div className="mt-auto flex items-baseline gap-3 border-t border-(--color-divider) bg-neutral-100/60 px-[18px] py-[10px]">
        <span className="whitespace-nowrap text-[13px] font-semibold tnum">
          {dealer.carCount} {dealer.carCount === 1 ? 'car' : 'cars'} listed
        </span>
        <span className="whitespace-nowrap text-[12px] ink-subtle tnum">
          {dealer.fromPriceLabel}
        </span>
        <span className="btn btn-ghost relative z-[2] ml-auto text-[12px]">
          View inventory{' '}
          <span aria-hidden="true" className="transition-transform group-hover:translate-x-[2px]">
            →
          </span>
        </span>
      </div>
    </article>
  );
}
