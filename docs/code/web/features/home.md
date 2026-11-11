# web / features/home

Parent: [web](../README.md)

The homepage as an entry into `/cars` (**R72**, the F081 slice as revised, and
the Homepage Deck redesign). There is no homepage search API and no homepage
query. The hero is the `/cars` search box (R79), and every car on the page comes
from an ordinary `/v1/vehicles` request with a filter.

The motion rules the redesign added are DESIGN-SPEC §1.7 (_Homepage motion_);
the layout is §3.2.

## `apps/web/src/features/home/home.constants.ts`

### `export const HOME_CATEGORIES`

The five shopping categories, in deck order: SUVs, Automatic, Under ₹10 lakh,
Family cars, Low kilometres. Each is the search it opens (`params`, the same
`VehicleSearchParams` the results page reads), the copy on its card, and its
icon. A category is a filter the marketplace already supports, so adding or
changing one is a constant, not an API change.

- **Family cars is `bodyType=muv`.** Listings carry no seat count, so "family"
  is the body type built for it: three rows. Sedans and SUVs have their own
  ways in. Chosen by the product owner.
- **Under ₹10 lakh sorts `price_asc`.** The card shows the three cheapest, and
  its button opens the same sorted search, so the cars on the card are the
  first cars on the page it opens. Unsorted, while stock is small, the card
  would repeat the newest cars the stream already shows.
- **Low kilometres is the `featured` one.** The redesign asked for a "hot"
  category. Nothing records views or enquiries per filter, so nothing can say
  what is hot; under 1,00,000 km is useful to buyers and is a filter that exists.
  The badge says _Featured_, which is true, rather than _Hot_, which would be a
  claim.

`RECENT_CAR_COUNT` (10) feeds both the stream and Recently added
(`RECENT_ROW_COUNT`, 4), so one read serves two sections.

## `apps/web/src/features/home/load-home.ts`

### `export async function loadHomeInventory()`

Six reads, in parallel: the ten newest cars, and three cars for each category.
All are `/v1/vehicles`, cached for 60 seconds under `VEHICLES_TAG`, which the
dealer's lifecycle actions revalidate.

**Promoted cars are available cars.** Reserved cars sort after every available
one (R71), and the loader drops any card that is not `AVAILABLE`, so a section
may show fewer cars but never one a buyer cannot open. Sold and withdrawn cars
never reach it.

**The makes come from the recent read's facets.** An unfiltered
`/v1/vehicles` already returns the brand facet over every available car, so
the strip costs no read of its own. Only the labels and values are used; the
counts never leave the server (**R78**).

**No section carries a number (R78).** How many cars Dealers-Drive holds is not
something the homepage tells a visitor. The reads happen on the server, so the
`available` and facet counts in the responses never reach the browser either.

### `unavailable: true`

The cars failing is not the homepage failing. `loadHomeInventory` says so rather
than returning nothing, and the page draws `SectionError` where the cars were.
An empty space would read as "there are no cars", which is a different and
wrong sentence. The deck, stream, strip and row all render nothing; the hero,
the shortcuts and the explainers stay.

## `apps/web/src/features/home/utils.ts`

### `export function categoryHref(category)`

One function so the hero shortcut and the card's button can never disagree
about where a category goes.

## `apps/web/src/features/home/hero-banner/hero-banner.tsx`

### `export function HeroBanner({ image, aside, children })`

The copy on the left; on the right, `aside` when the page gives one (the
stream), else the photograph. It replaced the full-bleed photo hero of **R81**:
the Deck design leads with stock, not a stock photo.

**The photograph is still one prop, `image`.** The layout never decides which
picture it shows, so the admin setting below still works unchanged. `image:
null` draws the dark ground and no `<img>`, so the frame is never a
broken-image icon.

**`z-10`, without `isolate`.** The search's suggestion panel hangs below the
banner. `z-10` lifts the banner above the sections that follow, whose
positioned children (card photos, the deck's sticky cards) would otherwise
paint over the panel, and stays under the sticky header's `z-20`. The old
`isolate` existed to keep the background photograph's `-z-10` behind the copy;
there is no background layer now.

## `apps/web/src/features/home/hero-banner/hero-banner.constants.ts` — `HOME_HERO_IMAGE`

The committed default: `apps/web/public/images/home-hero.webp`, a showroom
scene of a salesperson with an Indian family, supplied for R81. It is what the
hero shows, when it shows a photograph, whenever no operator has set one.

## `apps/web/src/features/home/hero-banner/utils.ts` — `heroImageFrom(configured)`

**The photograph is admin-editable.** Two platform-config keys, edited in
`/admin/config` under _Platform settings_: `home.heroImageUrl` (an `https:`
URL, or a path on the web app such as `/images/home-hero-diwali.webp`) and
`home.heroImageAlt` (its description). The API checks the URL on the way out
(`heroImage()` in `config.service.ts`: anything else — `http:`, `data:`,
`javascript:`, protocol-relative, a relative path — is `null`) and publishes it
as `heroImage` on `GET /v1/config/public`.

`heroImageFrom` picks the configured photograph when there is one and the
committed default otherwise, and keeps the default's description if the
operator left theirs blank, so the `<img>` is never unlabelled. Saving the
setting revalidates `CONFIG_TAG`, so the next homepage render uses it.

Since the Deck redesign the photograph shows only when fewer than four cars are
listed or the API is unreachable; with stock, the stream takes its place.

## `apps/web/src/features/home/stock-stream/stock-stream.tsx`

### `export function StockStream({ cars, className })`

Two columns of recent listings drift in opposite directions. The strip is a
visual showcase: its cards are articles rather than links, and it has no pause
button. Hover, clicks and touches do not interrupt the animation. The category
deck and Recently added remain the ways to open cars from the homepage.

`splitColumns` deals cars alternately so neighbouring cards differ. Each column
holds two copies with matching bottom padding, making `translateY(-50%)` one
complete pass without a jump. The second copy is `aria-hidden`, so assistive
technology reads each car once. Neither copy has interactive descendants.

Animation is declared only under `prefers-reduced-motion: no-preference`;
reduced-motion users get the still content.

## `apps/web/src/features/home/makes-strip/makes-strip.tsx`

### `export function MakesStrip({ makes })`

The marketplace's makes form a display strip, not navigation. They are plain
text, with no links or pause button. The two copies loop continuously; pointer
hover and touch do not change the animation. Below three makes the strip renders
nothing. Under reduced motion it becomes an ordinary horizontal scroller.

## `apps/web/src/features/home/makes-strip/makes-list.tsx`

### `export function MakesList({ makes, copy })`

A pass through the makes. The second pass is `aria-hidden` and hidden by default;
the motion stylesheet reveals it only when the strip animates. Matching side
padding makes half the track exactly one list. Text spans preserve alternating
make colours without creating navigation targets.

## `apps/web/src/features/home/category-deck/category-card.tsx`

### `export function CategoryCard({ category, position, total })`

**An empty category stays, and says so.** Family cars (MUVs) had no stock when
the deck shipped. Hiding an empty card would leave its hero shortcut pointing at
nothing on the page and make the deck's length depend on stock. Instead the
photo side shows the category's `emptyMessage`, and the button changes from
"Browse family cars", which would open an empty page, to "See every car".

**`overflow-clip`, not `overflow-hidden`.** Both clip the rounded corners, but
`overflow: hidden` makes the card a scroll container, and the lead photo's
`view()` timeline would bind to a container that never scrolls, so the slide-in
would never run.

**Sticky from `md` up, and never on a short screen.** On a phone the card is
taller than what is left of the viewport under the header. Stuck, the next
card would slide over its button before the visitor reached it. The same holds
on any screen under 640 px tall (`max-height`, a landscape phone).

**Below `md` the deck is a swipe row.** Five full cards stacked down a phone
were about 2,700 px of scrolling with none of the deck's motion. Each card is
now `min(82vw, 360px)` wide and snaps to the centre, so the next one always
shows at the edge. The cards drop their small photos and third fact there.
`dd-deck-card` names an inline view timeline on itself, and the card grows to
full size and opacity as it crosses the middle of the row; its photo slides a
few percent the other way on the same timeline.

### `--deck-top`

The sticky offset, set per card from `position`. Each card stops 16 px lower
than the one before, so the edges of the cards underneath stay visible as a
stack.

## `apps/web/src/features/home/category-deck/deck-stack.tsx`

### `export function DeckStack({ children, total, className })`

The one piece of the deck that needs script: how far the next card has slid
over this one (`coverProgress`) is a relation between two elements, and no CSS
timeline expresses it. It writes the number to `--deck-cover` and the CSS does
the rest (`.dd-deck-card` in `globals.css`). One `requestAnimationFrame` per
burst of scroll events.

**It asks the layout which deck it is, not the viewport.** Below `md` the same
cards sit side by side (`isBeside`). There every card has the same top, which
`coverProgress` would read as fully covered, so in the row it writes 0 and
tracks the card nearest the middle instead (`nearestToCentre`). Measuring the
cards keeps the breakpoint in one place, the class names, rather than repeating
it in a media query here.

The current card is the only React state, and it changes when a different card
reaches the middle, not on every scroll frame. It listens to its own scroll as
well as the window's, because the row scrolls sideways inside it.

It writes 0 under reduced motion, and does nothing at all where `matchMedia` is
missing (as in the unit-test DOM), the same guard as `MobileNav`.

## `apps/web/src/features/home/category-deck/deck-progress.tsx`

### `export function DeckProgress({ current, total })`

The "03 / 05" and bar under the swipe row. A row that shows one card and the
edge of the next gives no sense of how many there are; this does. It is
`aria-hidden` because every card already states its own position in its
heading group, and it is hidden from `md`, where the stack shows all five.
`DeckStack` draws it only when given `total`, so a bare stack in a story or a
test has none.

## `apps/web/src/features/home/category-deck/utils.ts`

### `export function coverProgress(card, next)`

0 while the next card is a full card-height below, 1 once it sits on top. A pure
function of two rectangles, so the arithmetic is tested without a browser.

### `export function isBeside(card, next)`

Whether the next card starts to the right of this one, which is the swipe row.
More than a pixel, so sub-pixel rounding in a column never reads as a row.

### `export function nearestToCentre(row, cards)`

The index of the card whose middle is closest to the middle of the row. The
first and last cards can reach the middle because the row is padded by half its
spare width.

## `apps/web/src/features/home/category-deck/category-icon.tsx`

### `export function CategoryIcon({ icon, className })`

Drawn in SVG, not an icon font or images, so it takes the text colour and
scales with the button. Always `aria-hidden`: the label beside it names the
link. The lettering inside the automatic and price icons ("PRN", "D", "₹10L")
is drawing, not text, and is excluded from the accessible name.

## `apps/web/src/features/home/category-deck/category-glyph.tsx`

### `dd-icon-*` — the parts that move

Inside a hero shortcut (`.dd-tile`) each icon acts out its category once as the
tile arrives: the cars drive in on turning wheels, the selector slides to D,
the price pops, the needle sweeps. The classes only name the parts; the motion
is in `globals.css` and applies nowhere else, so the same icon in an empty deck
card stays still.

Each part sets `transform-box: fill-box` so it turns about its own middle; an
SVG element otherwise turns about the corner of the drawing. The needle is the
exception: it pivots on the dial's hub, a point in the drawing's own
coordinates, so it uses `view-box` and that point. The white dot on each wheel
is what makes a turning disc visibly turn.

## `apps/web/src/features/home/discovery-row/discovery-row.tsx`

### `export function DiscoveryRow(props)`

Renders nothing when a row is empty, so the homepage never shows a heading
with an empty grid beneath it. "View all →" carries no number (**R78**).

### `dd-reveal-group`

From `md` the cards rise in one after another as the row enters the viewport.
On phones the row is a horizontal scroller, which becomes the cards' timeline
source and never scrolls vertically, so that reveal could not run there.
Instead each card names an inline view timeline on itself and comes to full
size and opacity as it is swiped into the middle of the row. Both sit behind
the same support check, and both rest at the finished card.

## `apps/web/src/features/home/discovery-row/discovery-band.tsx`

### `export function DiscoveryBand(props)`

The page-width band the Recently added row sits in. It exists so the empty case
is decided in one place: `DiscoveryRow` already renders nothing when it has no
cars, but the band's own padding would still have drawn an empty stripe.

## `journey-section/` · `trust-section/` · `audience-section/`

The homepage's three explainers, lifted out of `page.tsx` (R83). Each heading
carries an id the section is labelled by, so each is a named region — which is
what the order tests find them by.

### `dd-journey` — the line through the three steps

The steps are numbered because they are a sequence, and the line is what says
so. It draws as the section crosses the viewport and each number comes to full
strength as the line reaches it: across the top from `md`, down the left side
on a phone, where the steps stack. The timeline is named on the wrapper
(`--dd-journey`) so the line and all three numbers share one progress.

Only the line and the number badges change. The step text is never hidden, so
the section reads the same wherever the visitor stops scrolling, and with no
scroll-driven animation support the line is simply drawn.

### `dd-trust-point` — the rule above each point

The hairline above each of the five points is a `::before`, not a border, so
it can draw in from the left with `scaleX`; a border cannot be scaled apart
from its box. The five start one after another as the band enters.
