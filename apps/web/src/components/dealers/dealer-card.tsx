import type { DealerCard as DealerCardDto } from '@dealers-drive/contracts';
import Link from 'next/link';

import { Blueprint, ImageSlot, LogoTile, Plate, Tag } from '@/components/ui/primitives';

/**
 * DESIGN-SPEC §3.5 — the directory card.
 *
 * A 104px blueprint cover, then a body whose 44px logo tile is pulled up over
 * the divider by 34px. The whole card is the link to the portfolio; the inner
 * "View inventory →" is an affordance, not a second destination, so it is not a
 * nested anchor — the heading's link is stretched over the card with
 * `after:absolute after:inset-0` and the affordance is lifted above it.
 *
 * ## The card keeps its height (R17)
 *
 * A tagline and a service row are both optional, and a dealership an hour past
 * onboarding has neither — so the card used to be as tall as whatever it had to
 * say. Two things hold the height now, and they do different jobs:
 *
 *   · **`min-h`** is the floor: a page where *every* dealership is sparse still
 *     gets cards of the ordinary size rather than a grid of stubs. The number
 *     is the card with one line of name, two of tagline and one row of tags —
 *     104 cover + 1 divider + 28 padding + 42 identity + 36 tagline + 22 tags +
 *     31 footer + 30 of gaps.
 *   · **`grid-auto-rows: 1fr`** on the directory grid is what makes the cards
 *     match *each other*: every implicit row takes the height of the tallest,
 *     so a dealership with nothing to say is exactly as tall as the one beside
 *     it that has. It is on the grid rather than here because it is a fact
 *     about the row, and a card rendered on its own — the sandbox, a future
 *     "similar dealers" strip — should not be padded to a row it is not in.
 *
 * `line-clamp-2` on the tagline is what keeps that bargain affordable. Without
 * it one dealer writing 200 characters sets the height of every card on the
 * page, which is the same failure the other way round.
 *
 * ⚠️ The file is `dealer-card.tsx` and the export is **`DirectoryCard`**.
 * `DealerCard` is the *contracts type* it takes (finding D-6), and the sandbox
 * registry's `aliases` field exists so that somebody searching for either name
 * finds this component rather than writing a second one.
 */
export function DirectoryCard({ dealer }: { dealer: DealerCardDto }) {
  return (
    <article className="card relative min-h-[294px] gap-[10px] overflow-visible p-0">
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
        {/* The tile is pulled up over the cover's bottom edge; the identity
            block sits beside it, baseline-aligned to the tile's lower half. */}
        <div className="flex items-end gap-[10px]">
          <LogoTile initials={dealer.initials} size={44} className="relative z-[2] -mt-[34px]" />
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-2">
              <h3 className="min-w-0 flex-1 font-heading text-[17px] font-semibold leading-[1.2]">
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

        {/* Two lines at most, so that one verbose dealership cannot set the
            height of every card in the grid (R17). */}
        {dealer.tagline ? (
          <p className="line-clamp-2 text-[12px] leading-[1.5] ink-secondary">{dealer.tagline}</p>
        ) : null}

        {dealer.services.length > 0 ? (
          <div className="flex flex-wrap gap-[6px]">
            {dealer.services.slice(0, 3).map((service) => (
              <Tag key={service} className="text-[10px]">
                {service}
              </Tag>
            ))}
          </div>
        ) : null}

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
