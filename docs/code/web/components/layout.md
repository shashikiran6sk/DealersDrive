# web / components/layout

Parent: [web](../../README.md)

The notes below belonged to the files named under each heading. Each heading is the
declaration the note sat above.

## `apps/web/src/components/layout/customer-footer.tsx`

### `export interface FooterLink`

The buyer footer (**R44**).

## What changed, and why the quiet one was not enough

The baseline's footer was one row: a wordmark, the sentence the marketplace
rests on, and four links floated right. That is the right footer for a
product with four pages, and the wrong one for a product a buyer is asked to
hand a phone number to — there was nowhere to find out how to reach a person,
and nowhere the platform could be seen to exist off the platform.

So it grows into the ordinary shape: a brand column carrying the trust
sentence and the social row, then columns of destinations, then a bottom rule
with the copyright and the legal posture. Everything that made the old one
right is kept — it is still a **server** component that ships no JavaScript
(invariant 8), and it still says, on every public page, who is actually
selling the car.

## Which links it offers

**Exactly the destinations `CustomerHeader` offers, and nothing it invents.**
The rule matters because two of them — `/cars` (**F077**) and `/saved`
(**F087**) — have not landed yet. The header carries them anyway, deliberately
(see its reconstruction note), and a footer that quietly disagreed with the
header about which sections the site has would be the more confusing of the
two states. What it does _not_ do is invent an About, a Terms or a Careers
page to fill a column out: a footer link onto a 404 is the product telling a
buyer a page exists and then not having it.

Everything else here needs no route at all — a `mailto:`, a `tel:` and the
social profiles — which is why those columns are complete today.

## Where the social links come from

`platform_config`, edited at `/admin/config`, read through
`GET /v1/config/public`. Not from code, and not from a `NEXT_PUBLIC_*`
variable: an account is opened, renamed and closed on a marketing timescale,
and correcting a dead link on every public page in the product should not
need a deploy. The API drops any value that is not an `https:` URL before it
reaches this component, so an empty or mistyped key renders as a missing icon
rather than as a link into nowhere — see `config.service.ts`.

### `const BUYER_LINKS: FooterLink[] = [`

The buyer sections, in the header's order.

One list rather than three JSX blocks, so "does the footer agree with the
header" is a question somebody can answer by reading eight lines.

### `const DEALER_LINKS: FooterLink[] = [{ href: '/dealer', label: 'Dealer login' }]`

One door, and it is `/dealer` (**R35**).

The console decides between "sign in" and "finish onboarding" from the
session, so neither the header nor the footer has to guess which a visitor
needs — and therefore neither can get it wrong.

### `export interface CustomerFooterProps`

Only what the footer renders, rather than the whole `PublicConfig`.

The payload carries eleven fields and this component reads three; taking the
whole thing would make every sandbox scenario and every test construct eight
values that have no effect on the output.

An empty string is "we do not have one" for both contacts — that is what
`NO_PUBLIC_CONFIG` degrades to when the API is unreachable, and the row is
then absent rather than rendered blank.

### `<div className="mx-auto grid max-w-[1280px] grid-cols-1 gap-9 px-6 py-10 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr] l`

Explicit tracks rather than `auto-fit`: the brand column has to be the
wide one, and a span inside an `auto-fit` grid either overflows at one
column or leaves a dead track at six. One column at 375, two at 640,
four with a double-width brand at 1024.

### `{supportEmail ?`

An address and a number rather than a contact page, because both are
true today and a contact form is a route nobody has built. They come
from `GET /v1/config/public`, so a change of number is an operations
action rather than a deploy — and each is absent rather than blank
when the API could not be reached (`NO_PUBLIC_CONFIG`).

### `function FooterColumn({ title, children }: { title: string; children: ReactNode })`

One column: a heading and a list.

Each column is its own labelled `<nav>`, named by the heading a sighted
reader sees. The alternative — one landmark called "Footer" wrapping
everything — hands a screen-reader user a single undifferentiated list of
every destination on the page, which is the thing a footer's columns exist to
avoid. The `<ul>` inside is what makes each one countable.

### `function SocialRow({ links }: { links: PublicConfig['social'] })`

The social row, or nothing at all.

Nothing at all is the important half: a fresh deployment has published no
accounts, and a row of icons linking to a platform's own homepage — which is
what a hard-coded default would be — is worse than an absent row.

`rel="noreferrer"` as well as `noopener`: these are the only outbound links
on a buyer page, and the referring URL can carry a search a buyer ran.

## `apps/web/src/components/layout/customer-header.tsx`

### `export function CustomerHeader({ locations }: { locations: PublicLocations })`

DESIGN-SPEC §3.1 — sticky, 64px, white on a hairline.

A client component for one reason: `usePathname`, which is what marks the
current section. Everything else it renders is a link, and a link needs no
JavaScript — so if the pathname ever stops being read here, the `'use
client'` should go with it (invariant 8).

── Reconstruction slice ────────────────────────────────────────────────────
One piece of the baseline's header is still held back: **the saved-cars
count** is **F087**. `Saved cars` is a plain link here; the badge needs
`SavedCarsProvider`, which reads `localStorage`.

The location button is here, and it is **districts** rather than the
baseline's cities — see `LocationSelector` for why that is the better
question at this level, and not merely the one D6 left available.

The nav points at `/cars` (**F077**), `/dealers` (**F085**) and `/saved`
(**F087**). Those routes land after this one — which is the cost of bringing
the shell across before the rooms it frames, and the order Tier 12 chose.
────────────────────────────────────────────────────────────────────────────

### `<Suspense fallback={<LocationChipFallback />}>`

The selector is the only part of the header that reads the query
string, and `useSearchParams` opts a route out of static
prerendering unless it sits behind a boundary. Keeping the boundary
this tight means the rest of the header — logo, nav, the dealer
door — still renders on the server, and the button arrives with the same
markup a moment later.

### `<Link href="/dealer" className="btn btn-primary">`

One door, and it is a `/dealer` link (**R35**). The console already
decides between "sign in" and "finish onboarding" from the session,
so the header never had to guess which a visitor needed — but two
buttons pointing at that one door asked the visitor to guess
instead, and either answer took them to the same screen.

It carries `btn-primary` because it is now the only action in the
cluster, and it is visible at every width because it is the only
way in: the old secondary button was `hidden sm:inline-flex`, which
was affordable while a second button stood beside it and is not now.

### `function LocationChipFallback()`

The button's own footprint, so the header does not reflow when the real one
arrives. It reads "Select district" because that is what the button says for
every visitor who has not chosen one (**R23**).

### `export function HeaderLink(`

`aria-current="page"` as well as the colour, because status is never carried
by colour alone (DESIGN-SPEC §4.15) — a screen reader announces the current
section, and so does a monochrome display.

## `apps/web/src/components/layout/district-picker.tsx`

### `export function DistrictPicker(`

DESIGN-SPEC §2.14 / §2.18 — the district dialog, and everything that selects
a district.

## Why this is its own file (R23)

R22 built the dialog inside `LocationSelector`, because the header was the
only thing that opened one. **R23 gives the directory a second opener**: with
no district chosen the town chips are every town on the platform, which is
five rows of them at 120 dealerships and unreadable well before 200, so the
row is replaced by a `Select district` button until a district narrows it.

Two openers is the moment the dialog stops belonging to the header. What is
shared is not only the markup but the _selection rule_ — drop `city` and
`page`, go to the directory from anywhere else — and a second copy of that
rule is how the header and the directory come to disagree about what
choosing a district means.

So `DistrictPicker` owns the open state, the selection and the dialog, and
takes its trigger as a render prop. `LocationSelector` is the header's
trigger; `DirectoryFilters` is the directory's. Neither knows how a district
is applied.

## Districts, not cities

The baseline's version of this listed cities, off a five-row `cities` table
that **D6** removed. Districts is the better question at this level and would
have been even with the table: a district is the area somebody would drive
across, the towns inside it give no hint they are related — Arakkonam and
Walajapet share a district with Arcot and with nothing else — and a header
dropdown listing every town on the platform stops being readable at about
thirty. The towns are the chips on the directory, narrowed to whatever is
chosen here.

## Why it is a dialog (R22)

R19 restored the baseline's 220px panel with no height cap, and wrote down
what that cost: _"past roughly fifteen districts the menu is taller than a
short viewport and the last rows go under the fold. Tamil Nadu has 38, so
this is a decision to revisit when the platform is in more than a handful of
them."_ It also listed those 38 as one flat column — and a flat column is the
real problem, not the height. `Vellore`, `Bangalore`, `Madurai` in one list
asks a buyer to know which state each is in, and the ones who would ask are
exactly the ones who do not know.

So the menu became a centred dialog that says it: a **state** is a heading
you cannot click, and the **districts** under it are the buttons. The
hierarchy is the whole point — nothing here selects a state, and there is no
second way to select a district either.

## Keyboard

Enter or Space opens; the dialog then takes focus, traps it, closes on
Escape or a backdrop click and hands focus back to the trigger — all of it
Radix's, which is why `Dialog` exists (see its docblock, and component-map
finding **D-C**). Every district is a real `<button>`, so Tab reaches them
and Enter and Space choose them without anything here re-implementing that.

### `children: (chosen: DistrictChip | null) => ReactNode`

The control that opens the dialog, given whichever district is currently
in the URL so the trigger can name it.

A render prop rather than a plain node because the two triggers say
different things about the same state: the header names the chosen
district, and the directory's button exists precisely when there is none.

### `trigger={children(chosen)}`

The button is handed to the dialog rather than wired up outside it.
Radix's modal content restores focus to _its_ trigger on close, so a
button it does not know about leaves focus on `<body>` — see `Dialog`.
It also means `aria-haspopup="dialog"` and `aria-expanded` are Radix's
to keep true rather than two more attributes to remember.

### `export function useDistrictSelection(locations: PublicLocations):`

Reading the district out of the URL, and writing a new one back.

The one rule about what selecting a district _means_, in one place, because
R23 gave it a second caller. Exported so a future opener — a "near you"
suggestion, say — inherits the rule rather than restating it.

## Choosing a district drops the towns

`?district=ranipet&city=katpadi` is an empty page: Katpadi is in Vellore.
Rather than let a buyer navigate into that and wonder what they did, changing
the district clears `city` — the chips underneath are about to be a different
set of towns anyway. The page number goes with them, for the same reason.

### `next.delete('city')`

The towns belonged to the district being left, and the page number to a

### `next.delete('city')`

result set that no longer exists.

### `const target = pathname.startsWith('/dealers') ? pathname : '/dealers'`

A district filters dealerships, so it goes to the directory — from
anywhere that is not already showing one. Choosing a place from the home
page is a person saying where they are, and the useful answer to that is
the dealerships there, not the same home page with a query string on it.

### `function LocationDialog(`

The dialog itself.

Mounted only while open, so its search box and its state filter start empty
every time rather than remembering a search somebody abandoned three pages
ago. That is also what keeps the work below off every render of the header.

### `const matches = useMemo`

What the body shows: either the state groups, or — while something is
typed — one flat list of matches.

The flat list is the reason search is a separate mode rather than a filter
over the groups. A query that matches four districts across four states
would otherwise be four headings with one row under each, and the answer to
"which state is Vellore in" would be a heading a reader has to look up to.
In the flat list every row carries its own state, so no result is ambiguous
on its own (**R22**).

### `className="w-[min(880px,100%)]"`

§2.14's 440px is the width of a confirmation. This is a grid of 38
districts, so it takes the reference design's 880 and the same
`min(…, 100%)` shape, which is what keeps it inside a 360px phone.

### `placeholder="Search district or state"`

It says what it searches. The reference's placeholder offers
taluk and pincode; the payload is districts and the states they
are in, and a placeholder promising a field the data does not
have is a bug report waiting to be filed.

### `<button`

The way back, and it carries its own count rather than being an
escape hatch with a blank beside it.

### `{!searching && groups.length > 1 ?`

The state row is navigation, never a selection: pressing `Tamil Nadu`
narrows what is on screen and changes nobody's location. It appears only
when there is more than one state to move between — on a platform
trading in one state it would be a control with a single meaningful
option, which is a control that only takes up room.

### `showState`

Every result names its state, so no row is ambiguous on its
own — the whole reason search is a flat list.

### `function StateHeading({ group }: { group: StateGroup })`

A state, as a heading and nothing else.

Deliberately not a `<button>`, not focusable, with no hover, no pressed
styling and no cursor change: a state is not a place this product can be
filtered to, and anything that looks pressable here would be an invitation to
a dead end. That is the one rule this section has, so it is worth stating
where somebody might otherwise "improve" it.

The plate carries the RTO code because that is what the code _is_ — `TN 09 BX
4412` starts with the same two letters — which stretches §4.5's enumeration
of four plate uses by one, and does so on the one motif in the system that
means "a registration authority said this". A state the code map does not
recognise renders without one; see `lib/state-codes.ts`.

### `function DistrictGrid({ children }: { children: ReactNode })`

The grid the districts sit in. One column on a phone, four on a desktop —
`auto-fill` rather than fixed counts, so a state with three districts does
not leave a gap the width of a fourth.

### `function DistrictOption(`

A district — the only selectable thing in the dialog.

A real `<button>`, so Tab reaches it and Enter and Space choose it (§2.1:
never a `<div>` with an `onClick`). `min-h-11` is 44px, the mobile touch
minimum (§4.15), which the two-line body clears on its own everywhere else.

Selection is announced three ways over, because colour alone is not a status
(§4.15): `aria-pressed` for a screen reader, a ✓ for an eye, and the cobalt
border and `accent-100` fill for a glance. Remove the tick and the control
still says which one it is.

No shadow — §4.1 allows the dialog one and nothing inside it.

### `function FilterChip(`

A state filter. Navigation, not a selection — see the call site.

### `key: string`

Stable across renders and safe in an `id`; the state name is neither.

### `function groupByState(districts: readonly DistrictChip[]): StateGroup[]`

The districts, grouped under the state each one is in.

The pairing comes off the payload — `DistrictChip.state`, which the API takes
from the dealership's own address (**R22**). Nothing here infers a state from
a district's name, and there is nothing it could infer one from: D6 removed
the table that would have held the pair.

Order is the API's, twice over. Districts arrive busiest first and stay that
way; states are ordered by the dealerships in them, then by name, so two
states of the same size cannot swap places between requests. The districts
with no state recorded sort last whatever their size — it is a heading that
explains an absence, and an absence does not lead.

## `apps/web/src/components/layout/location-selector.tsx`

### `export function LocationSelector({ locations }: { locations: PublicLocations })`

DESIGN-SPEC §2.14 — the header's location button.

The dialog it opens, and the rule for what choosing a district means, are
`DistrictPicker`'s (**R23**) — the directory opens the same dialog from its
own button, and a second copy of the selection rule is how the two would come
to disagree. What is left here is the header's trigger and nothing else.

## "Select district", not "All districts" (R23)

The button used to read `All districts` before a choice was made, which is a
true description of what is on screen and a poor description of what the
button is _for_. It states a filter setting where a first-time visitor needs
an invitation, and it is the only control in the header that offers to narrow
the platform to somewhere near them.

`All districts` is not gone — it is the dialog's footer button, where it is
the way _back_ rather than the resting state, and it still carries its count.
Nothing about the unfiltered URL changed: `/dealers` with no `?district=` is
still every dealership, still what the directory shows on arrival, and still
the one dealers URL `indexPolicy` marks indexable.

## `apps/web/src/components/layout/social-icons.tsx`

### `const MARKS: Record<SocialLink['network'], ReactElement> =`

The six social marks, as inline SVG (**R44**).

**Inline rather than a library**, because the alternative is a dependency for
six paths — and no new dependency is added to this repository that the
baseline did not already have. They are drawn at `currentColor` on a
`0 0 24 24` box, so the footer's hover colour is the only thing that decides
how they look and there is no second palette to keep in step.

Every mark is `aria-hidden`: the accessible name lives on the anchor that
wraps it, which is where a screen reader will look for it, and an icon that
announces itself _as well as_ its link says everything twice.

### `export function SocialIcon({ network }: { network: SocialLink['network'] })`

One mark, 16×16, inheriting the anchor's colour.

`strokeWidth` is 1.6 rather than 1 because these sit at 16px beside 12–13px
text, and a hairline stroke at that size disappears against the footer's
ground on a non-retina display.
