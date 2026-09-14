# web / components/dealers

Parent: [web](../../README.md)

The notes below belonged to the files named under each heading. Each heading is the
declaration the note sat above.

## `apps/web/src/components/dealers/dealer-card.tsx`

### `const CARD_HEIGHT = 'h-[400px]'`

The card, to the pixel (**R21**, re-derived for **R28**).

Sized for the fullest card the API can produce, so that the fullest one is
the one that _fits_ rather than the one that sets the height for everybody.
The worst case is a long registered name over two lines, a tagline over two,
and three services that wrap to a second row — all three at once, which is an
ordinary Indian dealership with a complete profile.

**R21 arrived at 368 by measuring, not by adding up**, and said so: it
rendered the `Fullest` story, found the last row of chips ending exactly on
the box's bottom edge at 362, and added six for rounding. 400 was arrived at
the same way — set against the sandbox with the card on the screen.

It is worth recording that arithmetic disagreed, because the next person to
change the type scale will reach for arithmetic first. Deriving the number as
a delta from R21's 368 gives 424:

```
  368  the measured R21 height
  +24  a taller cover — 104 → 128
  +12  the plate row, which is new
         the tile is 48 pulled up 24, so it costs 24 below the cover, plus a
         12px gap under it — and it replaces the 10px card gap and the 14px
         body padding that used to sit there, so 36 − 24 = 12
  +20  the pledge panel's own padding — the tagline is 36 either way, but it
         is now inside 10px top and bottom
  ---
  424  — and the card measures smaller than that
```

Which is the same lesson R21 wrote down and is worth not learning twice: the
sum is a sanity check on the shape of the layout, not a source for the
number. It over-counts here because it treats each part as if it were laid
out alone, and the parts it adds up are the parts that were already carrying
slack — the fullest card is the one where the slack goes to zero, and where
it goes to zero is a question only a rendered card answers.

So `Fullest` is the story that guards this, and it guards it by eye: nothing
on it may be cut off. Clipping here is silent, and what it eats first is half
a row of chips. Re-measure against that story after any change to the type
scale, the tag padding or the cover.

A card with a one-line name and nothing optional filled in spends about 150
of those on white space above the footer. That is what a fixed size _costs_,
and it is worth paying here: a directory reads as a grid, and a grid whose
cells change proportion with their contents does not.

### `const COVER_HEIGHT = 'h-[128px]'`

The cover band, and the distance the logo tile is pulled up over it.

### `export function DirectoryCard({ dealer }: { dealer: DealerCardDto })`

DESIGN-SPEC §3.5 — the directory card.

A 128px cover band, then an identity plate row that straddles its bottom
edge, then the dealership's own words, then a footer pinned to the bottom.

The whole card is the link to the portfolio; the inner
"View inventory →" is an affordance, not a second destination, so it is not a
nested anchor — the heading's link is stretched over the card with
`after:absolute after:inset-0` and everything below it stays _underneath_
that overlay, so a click anywhere lands on the one link (**R29**).

## R28 — the plate row is its own row

The logo tile used to sit _inside_ the identity block, on the same flex line
as the heading, which is what made **R24** a bug worth fixing: the tile was
bottom-aligned to a block whose height the name set, so a name that wrapped
to two lines dragged the logo 21px down the card.

It is not in that row any more. The tile and the VERIFIED DEALER plate share
a row of their own, pulled up over the cover's bottom edge by half the tile,
and the name starts underneath both. The tile's position is therefore fixed
against the _cover_ rather than against the name, and no length of dealership
name can move it — R24's failure is structurally unavailable rather than
corrected, which is the better shape of fix and the reason the R24 test now
asserts the separation rather than the alignment.

The plate moving out of the heading row buys the second thing: the name gets
the full width of the card instead of whatever the plate left it, so a
registered name wraps at 254px rather than at 120.

## The card is one fixed size (R21)

`CARD_HEIGHT` is a hard height, not a floor. **R17** made every card in the
grid match every other, with `min-h` underneath and `grid-auto-rows: 1fr` on
the grid — and that was the wrong shape of answer. Cards matched each other,
but the size they all agreed on was the tallest card's, so writing a longer
tagline or adding a third service still made every card on the page taller.
A directory that changes proportion as its dealerships fill in their
profiles is not a fixed size; it is a shared variable one.

So the height is a constant, and the card's job is to fit inside it:

· **The name is clamped to two lines.** Indian dealership names run long —
"Sri Venkateswara Automobiles and Finance Private Limited" is four lines
at this width — and an unclamped heading is the largest variable on the
card.
· **The tagline is clamped to two lines**, as it has been since R17.
· **The prose region flexes and clips.** The pledge and the tags sit in a
`flex-1 min-h-0 overflow-hidden` box, so a two-row tag wrap eats slack
rather than height, and a sparse dealership leaves the slack empty. That
empty space _is_ the fixed size — it is what "the card does not shrink"
means when there is nothing to put in it.

The footer stays pinned to the bottom edge either way, which is what makes
the blank read as a card with room in it rather than as a card cut short.

Nothing reserves an empty box: with no tagline there is no pledge panel, and
with no services there is no tag row. The height comes from the container,
so a screen reader has nothing extra to announce.

⚠️ The file is `dealer-card.tsx` and the export is **`DirectoryCard`**.
`DealerCard` is the _contracts type_ it takes (finding D-6), and the sandbox
registry's `aliases` field exists so that somebody searching for either name
finds this component rather than writing a second one.

### `'transition-colors duration-150 hover:border-(--color-accent)'`

The one hover the card has. §2.7 is explicit that a card is "a border,

### `'transition-colors duration-150 hover:border-(--color-accent)'`

never a shadow", so the whole card lifting on hover is not available

### `'transition-colors duration-150 hover:border-(--color-accent)'`

here however common it is elsewhere — the border taking the accent is

### `'transition-colors duration-150 hover:border-(--color-accent)'`

the same signal in the system's own vocabulary.

### `{/* eslint-disable-next-line @next/next/no-img-element */}`

The dealership's own yard photograph, cropped to the band.

`alt=""` on purpose: the card's heading already names the
dealership, and the image carries nothing a buyer would lose — a
screen reader announcing "Annamalai Auto Mart — yard photo" right
before the link that says "Annamalai Auto Mart" is noise.

A plain `<img>` rather than `next/image` because the bytes come
from `MEDIA_BASE_URL`, which is the API's own origin in every
environment and a CDN host in production — configuring
`remotePatterns` for a host that moves per environment trades a
build-time constant for a runtime 400.

### `<div`

A wash into the bottom edge, so the white logo tile that straddles
that edge has something to sit against. A yard photograph is
whatever the dealer's phone saw — often a bright forecourt — and
a white tile on white sky is the one place the overlap stops
reading as an overlap. Only over a photograph: the `ImageSlot`
below is a flat panel that needs no help and would only be
dirtied by it.

### `<ImageSlot label={`${dealer.brandName} — yard photo`} />`

A dealership that has not uploaded one — or whose upload is still
being processed. The slot names the shot rather than showing a grey
rectangle, which is what makes the gap read as pending rather than
broken.

### `{dealer.isVerified ?`

The audit mark, over the corner of the cover.

It says what the plate below it says, in the place a buyer looks
first — the photograph is the thing that could be anybody's forecourt,
and the mark is what says this one was stood in. There is no year on
it: nothing on the platform records when a yard was audited, and a
date the product cannot stand behind is worse than no date.

### `<div`

The identity plate row, straddling the cover's bottom edge (**R28**).

`items-end` is safe here in a way it was not in R24: the two children
are a fixed-size tile and a single-line plate, and neither one's height
depends on the dealership's data. The row is pulled up by half the
tile, so the tile's top half is over the cover and its bottom half is
over the body — which is the whole point of it, and is why the row's
height contribution below the cover is 24px rather than 48.

### `className="relative mb-[12px] flex items-end justify-between gap-2"`

`relative` without a `z-index` (**R29**). It has to be positioned —
the cover above it is, and a static row would paint _under_ the
cover instead of straddling it. It must not be _lifted_: `z-[2]`
put it over the heading's stretched overlay, so the 24px band the
tile and the plate sit in was a dead strip across the top of the
card. Positioned and later in the document than the cover is
exactly enough to draw over it, and the overlay — later still —
draws over both, which is what makes the whole card one click
target.

### `className="border-(--color-ink) bg-white"`

The tile is a white chip with an ink hairline here rather than the

### `className="border-(--color-ink) bg-white"`

accent-tinted square it is elsewhere: it sits half on a

### `className="border-(--color-ink) bg-white"`

photograph, and the tinted fill has nothing to separate it from a

### `className="border-(--color-ink) bg-white"`

blue-grey forecourt. White against ink does.

### `<h3 className="line-clamp-2 font-heading text-[17px] font-semibold leading-[1.2]">`

Two lines at most (R21). A long registered name is the biggest
variable on the card, and four lines of it would push the tagline
and the tags out of the frame entirely. It has the full width of the
card now that the plate is in its own row above.

### `<div className="mt-[3px] text-[12px] ink-subtle tnum">{dealer.yearsLabel}</div>`

Already reads "Vellore, Tamil Nadu · 7 years" — one API-composed line.

### `<div`

The prose, in a box that flexes and clips (R21).

This is where the card's slack lives. A dealership with a two-line
tagline and three services that wrap to two rows fills it; one that
finished onboarding an hour ago leaves it empty; neither changes the
height of the card or of any card beside it. `min-h-0` is what lets a
flex child shrink below its content — without it `overflow-hidden`
never engages and the box pushes the footer down instead.

### `{/* `shrink-0` on both: a flex child shrinks before its parent clips`

Two lines at most, so that one verbose dealership cannot spend the
whole box (R17).

### `{dealer.tagline ?`

`shrink-0` on both: a flex child shrinks before its parent clips,
and a squeezed tag row cuts the bottom off its second line of
chips. They keep their natural height and the box clips instead —
which it never has to, because `CARD_HEIGHT` is sized for the
fullest of them.

### `<div className="shrink-0 border-l-2 border-(--color-accent) bg-(--color-neutral-100) px-[10px] py-[10px]">`

The pledge panel (**R28**) — the dealership's own sentence, set
apart from the card's own voice by a tint and an accent rule.

The quotation marks are `aria-hidden` and decorative. They are
what makes the sentence read as _quoted_ rather than as the
product describing the dealer, and a screen reader gets the
sentence without them: an announced "left double quotation mark"
before every tagline in a directory of eighteen is noise, and the
tint and rule carry nothing for it to lose.

### `variant={index === 0 ? 'accent' : 'neutral'}`

The **first** chip takes the accent (**R29**).

R28 accented the third, because that is what the UI
reference draws and every card it draws has three. Keyed
to the position rather than to the value it was at least
honest — nothing makes a third service more important than
a first — but the position it chose was the wrong one. The
chip row is read left to right and the accent is the eye's
entry point into it, so putting it last makes the highlight
land after the reader has already read the row.

It also degrades in the direction the data actually goes.
The rule is `index === 0`, and every dealership with at
least one service has an `index === 0` — so the row reads
the same whether a yard listed one service or twelve,
rather than losing its accent entirely below three.

### `<div className="mt-auto flex items-baseline gap-3 border-t border-(--color-divider) bg-neutral-100/60 px-[18px] py-[10px`

`mt-auto` is belt and braces now that the box above it is `flex-1`:
the footer is pinned to the bottom edge whether the card is full or
almost empty, which is what makes the slack read as room rather
than as a card cut short.

It runs to the card's own edges rather than sitting inside the body's
padding (**R28**), and takes a tint off the ground colour — which is
what makes it read as the card's base rather than as the last row of
its content.

### `<span className="btn btn-ghost ml-auto text-[12px]">`

Not lifted above the heading's overlay (**R29**).

It carried `relative z-[2]`, which raised the one part of the card
that most obviously invites a click above the anchor stretched over
everything else — so clicking "View inventory" did nothing at all,
while clicking the white space beside it opened the portfolio. It is
an affordance for the card's own link, so it belongs _under_ that
link's overlay: static, in flow, and unclickable in its own right.

## `apps/web/src/components/dealers/dealer-search-box.tsx`

### `export function DealerSearchBox(`

DESIGN-SPEC §3.5 and the Search-Bar UI reference — the directory's search
box, with recommendations (**R43**).

## What it replaces

A plain 260px input inside a `<form>`, which submitted the raw typed text as
`?q=` and offered nothing on the way. That input is gone: it asked a buyer to
spell a dealership's trading name correctly with no help and no feedback, and
on a platform where a yard may be registered as "Sri Lakshmi Motors" or "Sree
Lakshmi Motors" that is a coin toss between the grid and an empty state.

**The grid's `?q=` filter is unchanged** — this is a better way to arrive at
a search term, not a different kind of search. Choosing a recommendation
navigates to `/dealers?q=<that dealership's exact trading name>`, which is a
URL that was always valid, is shareable, server-renders, and survives the
back button like every other filter in the product (ARCHITECTURE §15.2).

## Why it does not navigate to the dealership

Jumping straight to `/dealers/<slug>` was the alternative, and it is the
wrong one _here_: this box sits above a grid the buyer is looking at, and a
control that replaces the page they are reading with a different page is a
link pretending to be a filter. The card in the grid is the way to the
portfolio, and it already is one.

## The interaction is not in this file

Debounce, abort, the stale-answer guard, the arrow keys and the ARIA live in
`components/ui/autocomplete.tsx`, which knows nothing about dealerships. This
file is the source, the row, and what selecting one means — which is all that
a `VehicleSearchBox` at **F077** should have to write.

### `q?: string`

The search currently applied to the grid — the box opens holding it.

### `district?: string`

The page's own filters, passed through so suggestions match the grid.

### `districtName?: string`

"Vellore", for the dropdown's heading. Absent on the unfiltered page.

### `onSearch: (term: string | null) => void`

Apply a search term, or clear it. `DirectoryFilters` owns the URL.

### `const source = useMemo<AutocompleteSource<DealerSuggestion>>`

Rebuilt only when the filters move. `useAutocomplete` holds it in a ref so
an unstable reference would not refetch, but a memo keeps the fetch closure
honest about which district it is asking within.

### `if (!response.ok) throw new Error(`Suggest failed: ${String(response.status)}`)`

Any non-2xx is a failed suggestion, and the panel says so. There is

### `if (!response.ok) throw new Error(`Suggest failed: ${String(response.status)}`)`

nothing per-status for a buyer to do differently: a 429 and a 502

### `if (!response.ok) throw new Error(`Suggest failed: ${String(response.status)}`)`

both mean "not right now", and the grid behind is unaffected either

### `if (!response.ok) throw new Error(`Suggest failed: ${String(response.status)}`)`

way because it was rendered from a different call.

### `valueOf: (item) => item.brandName`

What lands in the input, and — via `onSearch` — what filters the grid:

### `valueOf: (item) => item.brandName`

the dealership's exact trading name, which is what `?q=` matches on.

### `{item.matchedOn === 'brandName' ?`

Marked only when the name is _why_ this row is here. A
dealership offered because its town matched has none of the
typed characters in its name, and underlining nothing is the
honest rendering of that — see `DealerSuggestion.matchedOn`.

### `<HighlightedText text={item.metaLabel} match={search} />`

The place is what matched, so the place is what is marked.

### `<span`

The one affordance that says Enter will take this row, shown on
the row Enter would actually take. It is the whole explanation
of the default highlight, and it costs a line.

Hidden rather than absent on the other rows, which is what the
UI reference does and is not a detail: rendering it only on the
highlighted row takes ~70px away from that row alone, so the
meta line truncates on whichever row the buyer is on and the
whole list appears to reflow under the arrow keys.

## `apps/web/src/components/dealers/directory-filters.tsx`

### `export function DirectoryFilters(`

DESIGN-SPEC §3.5 — a 260px name search, and the row that narrows the grid.

Like every other filter in the product, this writes to the URL rather than to
a store, so `/dealers?district=vellore&city=katpadi,vellore` is shareable,
server-renderable and survives a back button (ARCHITECTURE §15.2).

## The row has two shapes now (R23)

**Within a district**, it is the towns in it, as toggle chips — unchanged.

**With no district chosen**, it is a `Select district` button, and only the
towns that are _already_ applied. The chips used to render in full here too,
and what they rendered was _every town on the platform_: forty-four of them
at 120 dealerships, five wrapped rows deep, before any of them had been
narrowed by anything. That is not a filter a buyer reads, it is a wall they
scroll past, and it gets monotonically worse with every dealership that signs
up — which is the wrong direction for the one control that makes the
directory usable.

## An applied town is always visible, district or not

`?city=` without `?district=` is not a hypothetical: `indexPolicy` names
`/dealers?city=vellore` as an indexable canonical, so it is a URL Google is
invited to send people to. Hiding the whole row on that page would apply a
filter the buyer can neither see nor clear — a worse fault than the wall,
because at least the wall was honest about what it was doing.

So the rule is not "chips inside a district". It is: **every applied town
shows, and the unapplied ones show once a district makes them a readable
set.** The `Clear towns` escape follows the selection rather than the
district, for the same reason.

The grid underneath is unchanged either way: **no district still means every
dealership**. This replaces the row that filters them, not the results. A
buyer who wants the whole platform gets the whole platform, and `/dealers`
stays the page `indexPolicy` marks indexable.

## Why a button and not a default district

Picking one for the visitor was the alternative, and it was considered and
rejected: the districts arrive busiest-first, ties broken alphabetically, so
on a flat distribution `districts[0]` is not "the busiest district" but the
one whose name starts earliest — and a visitor in Wayanad would be told, in
the page's own H1, that they were looking at dealers in Bengaluru Urban. An
invitation that is ignored costs a click. A wrong guess stated as fact costs
trust, and the buyer has no way to know it was a guess.

The button is also not a modal on arrival. Auto-opening the dialog would put
an interstitial over the one dealers URL the SEO policy indexes, and `Dialog`
makes the document inert and locks scroll behind it — so a district a visitor
cannot find in the list would leave them with no way forward at all.

## The row is the district's towns, not the platform's

`cities` arrives narrowed to whichever district was chosen, which is what
keeps the chips readable as the platform grows past one belt. Selecting a
district is `DistrictPicker`'s job; this component opens it and reads the
result, and never writes `?district=` itself.

### `city?: string[]`

The slugs currently toggled on.

### `locations: PublicLocations`

Every district on the platform — what the picker offers.

### `const districtName = locations.districts.find((entry) => entry.slug === district)?.name`

The district's _name_, for the dropdown's heading and placeholder. Read off
the list the picker already has rather than added as a prop: the page has
the slug in the URL and the names in `locations`, and a second copy of that
pairing is the thing D6 removed a table to avoid.

### `const visible = district ? cities : cities.filter((entry) => selected.has(entry.slug))`

Every town in the district, or — with no district to bound them — only the
ones already applied. Never the platform's whole list: that is the row this
revision exists to remove.

### `if (next.city.length > 0) params.set('city', [...next.city].sort().join(','))`

Sorted, so that picking the same two towns in either order produces the

### `if (next.city.length > 0) params.set('city', [...next.city].sort().join(','))`

same URL — one cache entry and one link, rather than two of each.

### `<DealerSearchBox`

The search box, with recommendations (**R43**). It is keyed on the
applied search so that a navigation — a chip, the back button, a shared
link — resets what is in it: the box owns what is typed between
searches, and the URL owns what has been searched for. The effect that
used to reconcile the two is gone with the form it belonged to.

### `{selected.size > 0 ?`

The way out of a multi-select. With one chip at a time, pressing the
active one cleared the filter and that was discoverable enough; with
several on, un-pressing each of them in turn is not.

It follows the selection and not the district, so a buyer who arrived on
`/dealers?city=vellore` from a search result has the same way out as one
who toggled the chip themselves.

### `{selected.size === 0 ?`

What the button is _for_, in one line, and only where there is room
for it to be read — once a town is applied the chips beside it say
what is going on and this would be a third thing competing to.

## `apps/web/src/components/dealers/location-card.tsx`

### `export function LocationCard(`

DESIGN-SPEC §3.6 — the third card in the portfolio's info row: a map of the
yard, and the button that opens it in Google Maps.

## Two independent things, and neither implies the other

The **button** is `address.mapsUrl` (**R6**) — the link the dealer pasted,
rendered as an anchor and nothing more. The **map** is `address.embedUrl`,
which the API composes from what that link turned out to carry. A dealership
can have the link and no map: a `maps.app.goo.gl` share link carries neither
a pin nor a place until it is followed, and following it is best-effort. So
the card renders whichever halves it has, and the button is never blocked on
the map.

Neither is ever composed from the typed address. A typed address is several
pins in one district, and a map confidently centred on the wrong one is
worse than the slot it would replace — it sends a buyer to somebody else's
gate and looks authoritative doing it.

## What is in the frame

When the dealer's link named a place, the embed comes back as Google's own
**place card** — the dealership's name, its address, its rating and review
count, the zoom controls and a directions control, all inside the map. That
is the whole reason the URL is composed on the server (**R14**): the card is
what a buyer working out whether to drive there actually wants, and it costs
a place id rather than a plain `lat,lng`.

A dealership whose link only ever gave coordinates gets the plain pin
instead. The card does not distinguish between them — it renders the frame it
is handed — because there is nothing useful it could do differently.

## Why an iframe rather than a picture

A static image would need the Maps Static API and therefore a key in every
environment, billed per view of a page built to be crawled. The embed is
keyless, and it pans and zooms — which is what somebody trying to work out
whether they can park actually wants.

The frame is Google's, so a visitor to a portfolio is disclosed to Google.
That is true of the "Get directions" button the moment it is pressed; the
map makes it true on load instead, which is the cost of drawing one at all.
`loading="lazy"` at least keeps it to visitors who scroll to it.

### `src={address.embedUrl}`

Composed by the API, not here — see `embedUrlFor` in
`platform/maps/maps-link.ts` for which of its shapes this is.

### `className="h-full min-h-[220px] w-full border-0"`

Tall enough for the place card to sit above the pin without
covering it. Google draws the card at a fixed size, so a 120px
frame renders the name over the top of the yard it names.

### `<ImageSlot label="Map — dealership location" />`

Nothing to draw: the dealer's link carried no pin and no place, and
could not be followed to either. The slot names what is missing,
and "Get directions" below still works.
