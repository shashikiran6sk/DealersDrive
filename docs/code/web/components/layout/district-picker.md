# web / components/layout/district-picker

Parent: [web](../../../README.md)

The notes below belonged to the files named under each heading. Each heading is the
declaration the note sat above.

## `apps/web/src/components/layout/district-picker/district-grid.tsx`

### `export function DistrictGrid({ children }: { children: ReactNode })`

One column on a phone, four on a desktop — `auto-fill` rather than fixed
counts, so a state with three districts does not leave a gap the width of a
fourth.

## `apps/web/src/components/layout/district-picker/district-option.tsx`

### `export function DistrictOption(`

A district — the only selectable thing in the dialog.

A real `<button>`, so Tab reaches it and Enter and Space choose it (§2.1:
never a `<div>` with an `onClick`). `min-h-11` is 44px, the mobile touch
minimum (§4.15).

Selection is announced three ways over, because colour alone is not a status
(§4.15): `aria-pressed` for a screen reader, a ✓ for an eye, and the cobalt
border and `accent-100` fill for a glance. No shadow — §4.1 allows the dialog
one and nothing inside it.

## `apps/web/src/components/layout/district-picker/district-picker.constants.ts`

### `selectDistrict: 'Select district'`

The resting label on every trigger that opens this dialog (**R23**).

### `searchPlaceholder: 'Search district or state'`

It says what it searches. The reference's placeholder offers taluk and
pincode; the payload is districts and the states they are in, and a
placeholder promising a field the data does not have is a bug report
waiting to be filed.

## `apps/web/src/components/layout/district-picker/district-picker.tsx`

### `children: (chosen: DistrictChip | null) => ReactNode`

The control that opens the dialog, given whichever district is currently in
the URL so the trigger can name it. A render prop rather than a plain node
because the two triggers say different things about the same state: the
header names the chosen district, and the directory's button exists
precisely when there is none.

### `export function DistrictPicker({ locations, children }: DistrictPickerProps)`

DESIGN-SPEC §2.14 / §2.18 — the district dialog, and everything that selects a
district.

**Its own file since R23**, which gave the directory a second opener. What is
shared is not only the markup but the _selection rule_ — drop `city` and
`page`, go to the directory from anywhere else — and a second copy of that
rule is how the header and the directory come to disagree about what choosing
a district means. So this owns the open state, the selection and the dialog,
and takes its trigger as a render prop.

**Districts, not cities.** The baseline listed cities off a table **D6**
removed; a district is the area somebody would drive across, and the towns
inside it give no hint they are related — Arakkonam and Walajapet share a
district with Arcot and with nothing else.

**A dialog, not a menu (R22).** R19's 220px panel had no height cap and listed
38 districts as one flat column — and the flat column is the real problem, not
the height: `Vellore`, `Bangalore`, `Madurai` in one list asks a buyer to know
which state each is in, and the ones who would ask are exactly the ones who do
not know. So a **state** is a heading you cannot click and the **districts**
under it are the buttons.

The keyboard is Radix's: Enter or Space opens, focus is trapped, Escape or a
backdrop click hands it back to the trigger.

### `trigger={children(chosen)}`

The button is handed to the dialog rather than wired up outside it:
Radix's modal content restores focus to _its_ trigger on close, so a
button it does not know about leaves focus on `<body>`. It also makes
`aria-haspopup="dialog"` and `aria-expanded` Radix's to keep true.

## `apps/web/src/components/layout/district-picker/district-picker.types.ts`

### `key: string`

Stable across renders and safe in an `id`; the state name is neither.

## `apps/web/src/components/layout/district-picker/filter-chip.tsx`

### `export function FilterChip(`

A state filter. Navigation, not a selection — see the call site.

## `apps/web/src/components/layout/district-picker/location-dialog.tsx`

### `export function LocationDialog(`

The dialog itself. Mounted only while open, so its search box and its state
filter start empty every time rather than remembering a search somebody
abandoned three pages ago — which is also what keeps the work below off every
render of the header.

### `const matches = useMemo`

Either the state groups, or — while something is typed — one flat list of
matches. The flat list is why search is a separate mode rather than a filter
over the groups: a query matching four districts across four states would
otherwise be four headings with one row under each, and "which state is
Vellore in" would be a heading a reader has to look up to. Every row in the
flat list carries its own state (**R22**).

### `className="w-[min(880px,100%)]"`

§2.14's 440px is the width of a confirmation. This is a grid of 38
districts, so it takes the reference design's 880 and the same
`min(…, 100%)` shape, which keeps it inside a 360px phone.

### `<button`

The way back, carrying its own count rather than being an escape
hatch with a blank beside it.

### `{!searching && groups.length > 1 ?`

The state row is navigation, never a selection: pressing `Tamil Nadu`
narrows what is on screen and changes nobody's location. It appears only
when there is more than one state to move between.

### `showState`

Every result names its state, so no row is ambiguous on its
own — the whole reason search is a flat list.

## `apps/web/src/components/layout/district-picker/state-heading.tsx`

### `export function StateHeading({ group }: { group: StateGroup })`

A state, as a heading and nothing else.

Deliberately not a `<button>`, not focusable, with no hover, no pressed
styling and no cursor change: a state is not a place this product can be
filtered to, and anything that looks pressable here would be an invitation to
a dead end.

The plate carries the RTO code because that is what the code _is_ — `TN 09 BX
4412` starts with the same two letters — which stretches §4.5's enumeration of
four plate uses by one, on the one motif in the system that means "a
registration authority said this".

## `apps/web/src/components/layout/district-picker/use-district-selection.ts`

### `export function useDistrictSelection(locations: PublicLocations):`

Reading the district out of the URL, and writing a new one back — the one rule
about what selecting a district _means_, in one place, because R23 gave it a
second caller. Exported so a future opener inherits the rule rather than
restating it.

**Choosing a district drops the towns.** `?district=ranipet&city=katpadi` is an
empty page: Katpadi is in Vellore. The page number goes with them.

### `next.delete('city')`

The towns belonged to the district being left, and the page number to a

### `next.delete('city')`

result set that no longer exists.

### `const target = pathname.startsWith(DIRECTORY_PATH) ? pathname : DIRECTORY_PATH`

A district filters dealerships, so it goes to the directory — from
anywhere that is not already showing one. Choosing a place from the home
page is a person saying where they are, and the useful answer to that is
the dealerships there, not the same home page with a query string on it.

## `apps/web/src/components/layout/district-picker/utils.ts`

### `export function dealersIn(group: StateGroup): number`

Every dealership under a state heading.

### `export function groupByState(districts: readonly DistrictChip[]): StateGroup[]`

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
