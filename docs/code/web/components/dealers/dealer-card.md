# web / components/dealers/dealer-card

Parent: [web](../../../README.md)

The notes below belonged to the files named under each heading. Each heading is the
declaration the note sat above.

## `apps/web/src/components/dealers/dealer-card/dealer-card-cover.tsx`

### `export function DealerCardCover({ dealer }: { dealer: DealerCardDto })`

The 128px cover band: the yard photograph, or the slot that names it.

### `{/* eslint-disable-next-line @next/next/no-img-element */}`

`alt=""` on purpose: the heading already names the dealership, and a
screen reader announcing "Annamalai Auto Mart — yard photo" right
before the link that says "Annamalai Auto Mart" is noise.

A plain `<img>` rather than `next/image` because the bytes come from
`MEDIA_BASE_URL`, which moves per environment — configuring
`remotePatterns` for it trades a build-time constant for a runtime 400.

### `<div`

A wash into the bottom edge, so the white logo tile that straddles it
has something to sit against — a yard photograph is often a bright
forecourt, and a white tile on white sky is the one place the overlap
stops reading as one. Only over a photograph: the `ImageSlot` is a
flat panel that would only be dirtied by it.

### `<ImageSlot label={DEALER_CARD_TEXT.coverAlt(dealer.brandName)} />`

Naming the shot rather than showing a grey rectangle is what makes the
gap read as pending rather than broken.

### `{dealer.isVerified ?`

The audit mark, in the place a buyer looks first — the photograph is the
thing that could be anybody's forecourt, and the mark says this one was
stood in. No year on it: nothing records when a yard was audited, and a
date the product cannot stand behind is worse than no date.

## `apps/web/src/components/dealers/dealer-card/dealer-card-footer.tsx`

### `export function DealerCardFooter({ dealer }: { dealer: DealerCardDto })`

Pinned to the card's bottom edge, running to its own edges rather than sitting
inside the body's padding (**R28**), with a tint off the ground colour — which
is what makes it read as the card's base rather than the last row of content.

### `<span className="btn btn-ghost ml-auto text-[12px]">`

Not lifted above the heading's overlay (**R29**). It carried `relative
z-[2]`, which raised the one part of the card that most obviously invites
a click above the anchor stretched over everything else — so clicking
"View inventory" did nothing while clicking the white space beside it
opened the portfolio. It is an affordance for the card's own link, so it
belongs under that link's overlay.

## `apps/web/src/components/dealers/dealer-card/dealer-card.constants.ts`

### `export const CARD_HEIGHT = 'h-[400px]'`

A hard height, not a floor, and **measured rather than derived** (**R21**,
re-derived for **R28**). The `Fullest` sandbox story is what guards it: a
two-line registered name, a two-line tagline and three services wrapping to a
second row, all at once — an ordinary Indian dealership with a complete
profile. Nothing on that story may be cut off; clipping here is silent and
what it eats first is half a row of chips.

Arithmetic disagrees, and that is worth recording because the next person to
change the type scale will reach for it first: adding the deltas to R21's
measured 368 gives 424, because it treats each part as if it were laid out
alone and the parts it adds up are the parts already carrying slack. The
fullest card is the one where the slack goes to zero, and only a rendered card
answers where that is. Re-measure against `Fullest` after any change to the
type scale, the tag padding or the cover.

### `export const COVER_HEIGHT = 'h-[128px]'`

The cover band, and the distance the logo tile is pulled up over it.

### `export const SERVICES_SHOWN = 3`

At most three, so one verbose dealership cannot spend the whole prose box.

## `apps/web/src/components/dealers/dealer-card/dealer-card.tsx`

### `export function DirectoryCard({ dealer }: { dealer: DealerCardDto })`

DESIGN-SPEC §3.5 — the directory card.

A 128px cover band, then an identity plate row that straddles its bottom edge,
then the dealership's own words, then a footer pinned to the bottom.

The whole card is the link to the portfolio; "View inventory →" is an
affordance, not a second destination, so it is not a nested anchor — the
heading's link is stretched over the card with `after:absolute after:inset-0`
and everything below stays _underneath_ that overlay (**R29**).

**The plate row is its own row (R28).** The tile used to sit on the heading's
flex line, bottom-aligned to a block whose height the name set, so a name
wrapping to two lines dragged the logo 21px down the card (**R24**). Its
position is now fixed against the _cover_, so no length of name can move it —
R24's failure is structurally unavailable rather than corrected. The name also
gets the card's full width, wrapping at 254px rather than 120.

**The card is one fixed size.** `CARD_HEIGHT` is a hard height and the card's
job is to fit inside it: the name and tagline are clamped to two lines, and the
prose region flexes and clips so a two-row tag wrap eats slack rather than
height. A sparse dealership leaves that slack empty — that empty space _is_ the
fixed size. R17's `min-h` made every card match the tallest one, which is a
shared variable size rather than a fixed one.

⚠️ The file is `dealer-card` and the export is **`DirectoryCard`**.
`DealerCard` is the _contracts type_ it takes (finding D-6).

### `'transition-colors duration-150 hover:border-(--color-accent)'`

§2.7 is explicit that a card is "a border, never a shadow", so the

### `'transition-colors duration-150 hover:border-(--color-accent)'`

whole card lifting on hover is not available here however common it is

### `'transition-colors duration-150 hover:border-(--color-accent)'`

elsewhere — the border taking the accent is the same signal in the

### `'transition-colors duration-150 hover:border-(--color-accent)'`

system's own vocabulary.

### `<div`

The identity plate row (**R28**). `items-end` is safe here in a way it
was not in R24: both children are fixed-size and neither one's height
depends on the dealership's data. Pulled up by half the tile, so its
height contribution below the cover is 24px rather than 48.

### `className="relative mb-[12px] flex items-end justify-between gap-2"`

`relative` without a `z-index` (**R29**). It has to be positioned or
it paints under the cover instead of straddling it; it must not be
lifted, because `z-[2]` put it over the heading's stretched overlay
and made the 24px band a dead strip across the top of the card.

### `className="border-(--color-ink) bg-white"`

A white chip with an ink hairline rather than the accent-tinted

### `className="border-(--color-ink) bg-white"`

square it is elsewhere: it sits half on a photograph, and the tint

### `className="border-(--color-ink) bg-white"`

has nothing to separate it from a blue-grey forecourt.

### `<h3 className="line-clamp-2 font-heading text-[17px] font-semibold leading-[1.2]">`

Two lines at most (R21) — a long registered name is the biggest
variable on the card, and four lines of it would push the tagline and
the tags out of the frame entirely.

### `<div className="mt-[3px] text-[12px] ink-subtle tnum">{dealer.yearsLabel}</div>`

Already reads "Vellore, Tamil Nadu · 7 years" — one API-composed line.

### `<div`

Where the card's slack lives (R21). `min-h-0` is what lets a flex child
shrink below its content — without it `overflow-hidden` never engages
and the box pushes the footer down instead.

### `<div className="shrink-0 border-l-2 border-(--color-accent) bg-(--color-neutral-100) px-[10px] py-[10px]">`

The pledge panel (**R28**) — the dealership's own sentence, set
apart from the card's voice by a tint and an accent rule. The
quotation marks are decorative: they make the sentence read as
quoted, and an announced "left double quotation mark" before every
tagline in a directory of eighteen is noise.

`shrink-0` here and on the tag row: a flex child shrinks before its
parent clips, and a squeezed tag row cuts the bottom off its second
line of chips.

### `variant={index === 0 ? 'accent' : 'neutral'}`

The **first** chip takes the accent (**R29**). R28 accented
the third because that is what the UI reference draws, but
the chip row is read left to right and the accent is the
eye's entry point — landing it last puts the highlight after
the reader has already read the row. `index === 0` also
degrades in the direction the data goes: every dealership
with one service has one, so the row reads the same whether a
yard listed one service or twelve.
