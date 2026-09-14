# sandbox / stories/layout

Parent: [sandbox](../../README.md)

The notes below belonged to the files named under each heading. Each heading is the
declaration the note sat above.

## `apps/sandbox/src/stories/layout/customer-footer.stories.tsx`

### `const SOCIAL: SocialLink[] = [`

The buyer footer (C021), as **R44** rebuilt it.

It used to be one row — a wordmark, the sentence the marketplace rests on,
and four links floated right. That is the right footer for a product with
four pages and the wrong one for a product a buyer is asked to hand a phone
number to: there was nowhere to find out how to reach a person, and nowhere
the platform could be seen to exist off the platform.

Two things about it are worth looking at rather than reading:

**The social row is configuration.** The links come from `platform_config`
via `GET /v1/config/public`, so what this component receives depends on what
an operator has published at `/admin/config` — and the interesting state is
the empty one, because that is what a fresh deployment looks like.

**The columns claim only what exists.** Every route here is one
`CustomerHeader` also offers; the footer invents no About, Terms or Careers
page to square the columns off, because a footer link onto a 404 is the
product telling a buyer a page exists and then not having it.

It takes props but still reads nothing and handles nothing, so it remains a
**server** component that ships no JavaScript (invariant 8).

### `export const Default: Story = {}`

Everything published: six marks, both contacts, four columns.

### `export const NoSocialAccounts: Story =`

**A fresh deployment.** No social account has been published yet, so the row
is absent entirely rather than a set of icons pointing at a platform's own
homepage — which is what a hard-coded default would be.

### `export const TwoNetworks: Story =`

Two networks. The row is a row, not a grid — it is sized by what it holds.

### `export const ApiUnreachable: Story =`

**What the API being unreachable looks like** (`NO_PUBLIC_CONFIG`). The
layout degrades rather than throwing — a throw there escapes every boundary
below the root — so the footer loses the contacts and the social row and
keeps its links and its trust line.

### `export const Tablet: Story =`

The four columns become two at 640 and one below it, brand block first.

## `apps/sandbox/src/stories/layout/customer-header.stories.tsx`

### `const LOCATIONS: PublicLocations =`

DESIGN-SPEC §3.1 — the buyer chrome (C0xx). Sticky, 64px, white on a hairline.

**The pathname is most of the state it has.** It reads `usePathname()` and
lights the section a visitor is in, so the `nextjs.navigation.pathname`
parameter is the control and there is one story per section rather than one
story with a knob. Its one prop is the district list the location button
offers — see `Layout/LocationSelector` for that component on its own.

The rule is prefix matching, and `/` is deliberately not in the nav — the home
page lights nothing, because `startsWith('/cars')` is false there and the
wordmark on the left is already the way back.

Two things to check by eye:

· **The current section is marked twice**, in colour _and_ in
`aria-current="page"`. Status is never carried by colour alone
(DESIGN-SPEC §4.15), and here that is a navigation aid rather than a
nicety: a monochrome display and a screen reader must both be able to say
where the reader is.
· **The nav disappears below 768px** (`hidden md:flex`), and the dealer
button shortens from "Dealer login" to "Login" below `lg`. It never
vanishes: since **R35** it is the only door into the console, so it is
visible at every width. Switch the viewport to Mobile 375 to see the row
the majority of buyers actually get.

── What is missing, and why ────────────────────────────────────────────────
The **saved-cars count** is **F087**, and needs the `SavedCarsProvider`
decorator this sandbox does not have yet — which is coupling **C-1**, and the
reason `withSavedCars` is on the decorator list in `component-sandbox.md` §8.
When it lands, this file gains the badge at 0/1/99 plus pre-hydration.

The baseline's **city chip** is not missing — it is the location button, and
it lists districts instead. `LocationSelector`'s own stories say why.
───────────────────────────────────────────────────────────────────────────

### `<div style={{ minHeight: 220, background: 'var(--color-bg, #f4f5f7)' }}>`

A strip of page under it, so the hairline and the sticky offset read as

### `<div style={{ minHeight: 220, background: 'var(--color-bg, #f4f5f7)' }}>`

a header rather than as a floating bar.

### `export const Home: Story = {}`

The home page. Nothing in the nav is current — by design, not by omission.

### `export const DealerPortfolio: Story =`

A dealer's portfolio (**F086**). Prefix matching is what keeps _Dealers_ lit
on a page whose path is two segments deeper — the same rule `AdminNav` uses,
and the reason it is a prefix rather than an exact match.

### `export const Mobile: Story =`

Below 768px the nav is gone; the logo, the district button and the one door remain.

### `export const Tablet: Story =`

Between `sm` and `lg`: the nav is back, the button label is still short.

## `apps/sandbox/src/stories/layout/district-picker.stories.tsx`

### `const FOUR_STATES: PublicLocations =`

The district dialog itself (C071), and the one rule for applying a district.

## Why it is a component and not part of the header

R22 built this inside `LocationSelector`, which was right while the header
was the only thing that opened one. **R23 gave the directory a second
opener**: with no district chosen, `DirectoryFilters` was rendering every
town on the platform as chips — forty-four of them at 120 dealerships, worse
with every signup — so the row became a `Select district` button instead.

Two openers is the moment the dialog stops belonging to the header. What is
shared is not only the markup but the **selection rule**: drop `city` and
`page`, go to `/dealers` from anywhere else. A second copy of that rule is
how the header and the directory would come to disagree about what choosing
a district means — so `useDistrictSelection` is exported beside the component
and a third opener inherits it rather than restating it.

The trigger is a **render prop**, given whichever district is in the URL. The
two callers say different things about the same state: the header names the
chosen district, and the directory's button exists precisely when there is
none. `HeaderTrigger` and `DirectoryTrigger` below are those two, verbatim.

Everything about the dialog's own design — states as headings, districts as
buttons, the state filter that never selects, the flat search list where
every row names its state — is R22's and is documented on
`Layout/LocationSelector`, which is the same dialog behind the header's
button. This file is about the sharing.

### `export const HeaderTrigger: Story =`

The header's trigger — `LocationSelector`'s, exactly.

It names the chosen district, and reads **`Select district`** when there is
none. That label is R23's: `All districts` was a true description of what is
on screen and a poor description of what the button is for.

This is the seeded dev database's real geography — twelve districts across
four states, 120 dealerships — so the state filter row and the grouping are
both doing work rather than being demonstrated on two rows.

### `export const DirectoryTrigger: Story =`

The directory's trigger — `DirectoryFilters`', exactly.

Same dialog, same selection rule, different button. It never names a chosen
district because it is only rendered when there is not one: inside a district
the row is the towns in it, and the header keeps the way to change it.

### `export const OneChosen: Story =`

A district already chosen, through the header's trigger.

Two things to look at. The trigger names it rather than saying `Select
district` — the render prop is handed the district the URL carries. And
inside, `All districts` in the footer is enabled and carries the platform's
count: it is the way back, which is the role that label kept at R23.

The story sets the URL through the Next router decorator rather than through
a prop, because the component reads `?district` and nothing else does.

### `export const NoDistricts: Story =`

The empty case, and it is not hypothetical: `getPublicLocations` catches a
failed `/v1/locations` and degrades to this rather than letting a throw take
the whole document to `global-error`.

Both triggers must still be buttons, the dialog must still open, and it must
say what is going on rather than showing an empty white box.

## `apps/sandbox/src/stories/layout/location-selector.stories.tsx`

### `const TAMIL_NADU: PublicLocations['districts'] = [`

DESIGN-SPEC §2.14 / §2.18 — the header's location button (C069), and the
dialog it opens.

## It lists districts, and that is the first interesting decision

The baseline's version listed cities, off a five-row `cities` table that
**D6** removed. Districts is the better question at this level and would have
been even with the table: a district is the area somebody would drive across,
the towns inside it give no hint they are related — Arakkonam and Walajapet
share a district with Arcot and with nothing else — and a header dropdown
listing every town on the platform stops being readable at about thirty. The
towns are the directory's chips, narrowed to whatever is chosen here.

## And **R22** is the second: it is a dialog, grouped by state

R19 restored the baseline's 220px panel and wrote down what it cost — "past
roughly fifteen districts the menu is taller than a short viewport". The
`ManyDistricts` story existed to make that visible. It turned out the height
was the smaller half of the problem: 38 districts in one flat column asks a
reader to already know which state each is in, and the reader who would ask
is exactly the one who does not.

So: a centred dialog, and the hierarchy is the whole design.

· A **state** is a heading. Not focusable, no hover, no cursor change,
nothing pressable about it — a state is not a place this product can be
filtered to, and anything that looked clickable would be a dead end.
· A **district** is a `<button>`, and the only selectable thing here.
· The state row at the top **filters** and never selects. Press
`Karnataka` and the Tamil Nadu block goes away; nobody's location changed.

## And **R23** is the third: the label, and who else opens it

The button reads **`Select district`** until one is chosen, where it used to
read `All districts`. That was a true description of what is on screen and a
poor description of what the button is _for_ — it stated a filter setting to
a first-time visitor who needed an invitation. `All districts` is not gone;
it is the dialog's footer button, where it is the way _back_ and carries its
count.

The dialog itself now lives in `DistrictPicker` (C071), because the directory
opens the same one from its own button. This component is the header's
trigger and nothing else.

## What to check by eye

· **Open it.** The trigger is the only thing rendered until you do.
· **The plate on each state header** carries the RTO code — `TN`, `KA` —
which is what those letters _are_: `TN 09 BX 4412` begins with them. A
state the code map does not recognise renders without one; `Untidy` below
is the story for that.
· **It writes to the URL**, like every filter in the product — watch the
router panel while choosing. Changing the district also _drops_ `city`
and `page`, because `?district=ranipet&city=katpadi` is an empty page.
· **Selection is immediate.** Choosing pushes and closes; there is no
confirm step, because there was not one before and this change is about
the shape of the list, not the flow.
· **Search never leaves a result ambiguous.** Type `ur` — every row names
its state, because a flat list of `Tirupattur / Mysuru / Bengaluru Urban`
with no states is the exact thing R22 removed.
· **The shadow**, and the 7px corner. One of three elements in the product
that carries one (§4.1), and the only radius above 4 (§4.3).
· **Keyboard.** Enter or Space opens, focus lands inside, Tab is trapped,
Escape closes and focus returns to the button. `Dialog` owns all of that.
· **Mobile 375.** One column of districts, the search field under the
title, and the footer still reachable. No horizontal scroll anywhere.

### `const ONE_STATE: PublicLocations =`

Where the platform is today: one state, so no state filter row is drawn.

### `export const Default: Story = {}`

The default, and today's real shape: three districts in one state.

The state filter row is **absent**, on purpose. One state to move between is
not a choice; it is a control taking up room. It appears at two.

### `export const Chosen: Story =`

A district chosen. Open it and Vellore is the cobalt row — border, `accent-100`
fill, cobalt label and a ✓, because status is never colour alone (§4.15).

The footer names the pair — "Selected: Vellore, Tamil Nadu" — which is the
sentence this whole revision exists to be able to write, and the way back to
every district sits beside it carrying its own count.

The story sets the URL through the Next router decorator rather than through
a prop, because the component reads `?district` and nothing else does.

### `export const ManyStates: Story =`

Four states — the platform after it spreads, and the case R22 was built for.

This is the story to read the design off. Four headings, four plates, four
grids, and the state filter row at the top. Nothing about `Bengaluru Urban`
requires the reader to know it is in Karnataka; the heading above it says so.

Press `Karnataka` in the filter row and watch what does **not** happen: the
router panel stays empty. Filtering is not selecting.

### `export const ManyDistricts: Story =`

Fourteen districts in one state — what R19's `ManyDistricts` story showed as
a column running off the bottom of the screen.

The comparison is the point of keeping it. Same data, and now it is a grid
inside a panel that scrolls, under a heading that says where it is.

### `export const Untidy: Story =`

The data as it actually arrives sometimes: `state` is free text a dealership
typed, so it can be blank, and it can be a spelling the RTO-code map does not
know.

Two things to check. `Goa` has no plate rather than a guessed one — a wrong
two-letter code on something shaped like a number plate is worse than none.
And the districts with no state at all group under **State not recorded**,
which sorts last however big it is: it is a heading explaining an absence,
and an absence does not lead.

### `export const NoDistricts: Story = { args: { locations: { districts: [], total: 0 } } }`

The empty case, and it is not hypothetical: the public layout catches a
failed `/v1/locations` and degrades to this rather than letting a throw take
the whole document to `global-error`. The button must still be a button, the
dialog must still open, and it must say what is going on rather than showing
an empty white box.
