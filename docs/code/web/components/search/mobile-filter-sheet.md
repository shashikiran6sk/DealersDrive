# web / components/search/mobile-filter-sheet

Parent: [web](../../../README.md)

## `apps/web/src/components/search/mobile-filter-sheet/mobile-filter-sheet.tsx`

### `export function MobileFilterSheet(...)`

DESIGN-SPEC §3.3's mobile filters (**F079**): below `lg` the rail is hidden and
a _Filters_ button beside the sort opens **the same `FilterPanel`** in a bottom
sheet. One panel, two containers — not a second set of controls that could come
to disagree with the rail.

**On the `Dialog` primitive, not a hand-rolled overlay.** The legacy sheet was a
fixed `<div role="dialog">` with its own Escape listener and scroll lock and no
focus trap. `Dialog variant="sheet"` gives it Radix's trap, Escape, focus
return to the button and the locked page behind it — the contract
`dialog.test.tsx` already holds the primitive to.

**Filters apply as they are ticked**, as on the rail, and the sheet stays open
across the navigation (it is client state on a page that re-renders in place).
So _Show N cars_ carries the **live** total from the response rather than an
estimate, and all it has to do is close. While the next page renders it reads
_Updating…_; the button is `aria-live` so the new number is announced.

### `MOBILE_FILTER_SHEET_TEXT.openLabel(active)`

The badge is a number to the eye and a sentence to a screen reader: "Filters,
2 filters applied". The district is not counted — it is the page's scope,
chosen in its own control, not a filter.

### `idPrefix="sheet"`

The rail's panel is in the DOM (hidden) while the sheet is open; a second
prefix keeps every `id` unique.

## `apps/web/src/components/ui/dialog/dialog.variants.ts`

### `sheet`

§3.3's bottom sheet: the `rgba(20,23,28,0.45)` backdrop, a white panel along
the bottom edge up to 85% of the viewport, the §1.7 `sheet` motion (200 ms
ease-out, `dd-sheet-up`), a 44px close for §4.15's touch minimum, and the
footer pinned under a scrolling body so _Show N cars_ never scrolls away.
