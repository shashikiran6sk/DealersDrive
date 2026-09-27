# web / components/search/district-scope

Parent: [web](../../../README.md)

## `apps/web/src/components/search/district-scope/district-scope.tsx`

### `export function DistrictScope({ locations }: DistrictScopeProps)`

The `/cars` page's own opener for the district dialog (**R50**). The header's
selector already scopes the page — this is the same dialog, reached from the
place a buyer is reading, with a line that says what the grid is scoped to.

It holds **no selection logic of its own**. The dialog, the rule for what
choosing a district means and the counts are all `DistrictPicker`'s, so the
header and this button cannot disagree about where a choice goes. That is the
same reason `DirectoryFilters` opens the picker rather than drawing a second
one (**R23**).

The hint sits _beside_ the picker rather than inside its trigger: Radix hands
its trigger `asChild`, so the trigger has to be the button itself, and a hint
inside a button is read out as part of its name.

### `DISTRICT_SCOPE_TEXT.everyDistrictHint`

No district is every district — the default is the whole marketplace, never a
district picked for the buyer. R23 worked through a default district and
rejected it on its own numbers: with a flat distribution the "busiest"
district is the one whose name sorts first.
