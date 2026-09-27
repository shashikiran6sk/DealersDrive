# web / components/search/filter-panel

Parent: [web](../../../README.md)

## `apps/web/src/components/search/filter-panel/filter-panel.tsx`

### `export function FilterPanel(...)`

DESIGN-SPEC §3.3 — the marketplace's filters (**F078**), written to the **URL**
and nowhere else, so every state is server-rendered, shareable, bookmarkable
and back-button-correct. Built fresh against the F076 facets rather than
ported: the legacy panel had four checkbox groups and a price slider; this has
twelve groups, and the legacy structure (`facets`, `params`, `basePath`,
`groups`) is what carried over.

**No generic Location.** Location is the header's district plus the
_City / Town_ group, which exists only inside a district — the facets are
empty without one, so the group is simply absent.

**Dependent groups follow the facets.** _Model_ asks for a brand until one is
ticked, then lists that brand's models; unticking a brand drops its models from
the URL (`toggleBrand`), because a Creta with Hyundai unticked is an empty page.

### `const [params, setParams] = useOptimistic(applied)`

A tick shows at once. The checkbox is controlled by the URL, which does not
change until the server answers; without this a buyer clicks, sees nothing,
and clicks again — undoing the first. The optimistic value lives only while
the navigation's transition does and is replaced by the server's answer.

### `const CSV_GROUPS`

One table from group to parameter to facet, so the order of the panel is the
`groups` prop's and nothing else — the portfolio passes the same list minus
_City / Town_ and _Dealer_.

## `apps/web/src/components/search/filter-panel/facet-row.tsx`

### `export function FacetRow(...)`

§2.4's filter row: a native checkbox or radio inside its `<label>`, so the
whole row is the hit target. A zero-count row is `opacity:0.4` and still
operable — a ticked value whose last car has sold must stay untickable.

### `aria-label={... FILTER_PANEL_TEXT.named(label, count)}`

The name is set outright ("Petrol (18 cars)") rather than composed from the
row's spans: accessible-name computation trims each child's text, so the
visible label and count ran together as "Petrol18" in one engine and read with
a stray space in another.

## `apps/web/src/components/search/filter-panel/facet-checkbox-list.tsx`

### `limit = COLLAPSED_ROWS`

Six rows, then _Show all N_. A ticked value past the fold is still shown, so
a filter is never applied out of sight.

## `apps/web/src/components/search/filter-panel/range-presets.tsx`

### `export function RangePresets(...)`

Price and distance are **presets**, as radios, with counts — the brief's
bands, from `PRICE_PRESETS` / `KM_PRESETS` in contracts, whose bounds are the
query's own `min`/`max`. A slider across ₹1 lakh–₹50 lakh is unusable at the
resolution a buyer thinks in (the legacy's own note said as much), and a band
with a count says what choosing it will do. A range that matches no preset — a
shared link, a hand-edited URL — shows as a checked _Custom range_ row rather
than silently selecting nothing.

## `apps/web/src/components/search/filter-panel/year-range.tsx`

### `export function YearRange(...)`

Two selects over the **manufacturing** years the facets offer, because that
is the year on the card's plate. Choosing a floor above the ceiling drops the
ceiling rather than writing a range the API would refuse.

## `apps/web/src/components/search/filter-panel/filter-group.tsx`

### `<legend className="sr-only">{label}</legend>`

A `<fieldset>` so a screen reader announces the group with every control in
it; the visible heading is `aria-hidden` so it is not read twice.
