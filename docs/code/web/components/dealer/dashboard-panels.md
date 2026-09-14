# web / components/dealer/dashboard-panels

Parent: [web](../../../README.md)

The notes below belonged to the files named under each heading. Each heading is the
declaration the note sat above.

## `apps/web/src/components/dealer/dashboard-panels/dashboard-panels.constants.ts`

### `export const RECENT_ENQUIRIES_SHOWN = 4`

The newest four leads is what §3.12 draws.

## `apps/web/src/components/dealer/dashboard-panels/index.ts`

### `export { RECENT_ENQUIRIES_SHOWN, RECENT_ENQUIRIES_TEXT } from './dashboard-panels.constants'`

DESIGN-SPEC §3.12 — the dashboard's two panels (**F048**).

The baseline declares both as private functions inside
`app/(dealer)/dealer/page.tsx`. They are their own files here because a
component that exists only inside a feature implementation, with no sandbox
entry, is not done (CLAUDE.md §6) — and a component cannot have a sandbox
entry if it cannot be imported.

## `apps/web/src/components/dealer/dashboard-panels/recent-enquiries.tsx`

### `export function RecentEnquiries(`

The newest four leads, each with a one-tap `tel:`. The empty state is not a
placeholder — it is the state every new dealership sees, and until `Enquiry`
lands at **F088** it is also the only state the API can produce.

The baseline's heading row carries an `All enquiries →` ghost button onto
`/dealer/enquiries`, which arrives with **F065**. It is held back rather than
pointed at a 404, and both return together.

## `apps/web/src/components/dealer/dashboard-panels/views-chart.tsx`

### `export function ViewsChart({ chart }: { chart: DashboardResponse['viewsChart'] })`

Seven bars and a total (DESIGN-SPEC §3.12).

**The heights are `heightPct` from the API, not a ratio computed here** —
that is the only way the chart cannot disagree with the numbers beside it
(rule 6, §4.11). The service scales them against the week's own maximum, with
a floor of 1 so a quiet week renders flat rather than `NaN%`.

Each bar carries its own `aria-label`, because a chart is the one place where
the information is entirely in the geometry.
