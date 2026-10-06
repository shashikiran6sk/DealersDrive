# web / components/ui/link-pending

Parent: [web/components/ui](README.md)

Immediate feedback on a click that leads to a server-rendered page (**R101**).

## `apps/web/src/components/ui/link-pending/link-pending-indicator.tsx`

### `export function LinkPendingIndicator`

Every console page, every car and every dealership is rendered on demand. Before
R101 a click on one of their links changed nothing on screen until the whole page
had come back from the server — on production latency, one to three seconds of
what looked like a dead click (the recording: 03:52, 05:28, and the home-page
car cards).

`useLinkStatus` (Next 15.3+) tells a component inside a `<Link>` that the link's
navigation is in flight. The indicator renders the same 14px `Spinner` that
`Button loading` already draws, so a pending link looks like every other thing
in the product that is busy.

- **It fades in after 120ms** (`.dd-pending`). A prefetched navigation commits in
  a frame or two, and a spinner that flashes for 30ms is noise.
- **`reserve`** keeps a 14px box while idle, so a nav label does not move when the
  spinner appears. The sidebar uses it; absolutely positioned uses (cards,
  header links, the mobile tab bar) do not need it.
- **No `cn`.** The indicator is on every public page; `cn` pulls in
  `tailwind-merge` (~9 kB), which pages like `/contact` and `/enquiries` did not
  otherwise ship. Callers pass a complete box (`size-[..]` included) instead.

It is feedback, not the loading state itself: the page content's `loading.tsx`
skeleton is what fills the main area. The spinner says "your click was heard";
the skeleton says what is coming.

## `apps/web/src/components/ui/link-pending/link-pending-label.tsx`

### `export function LinkPendingLabel`

The button-shaped variant, for `ButtonLink` and every `<Link className="btn …">`
or `.dd-chip`. The label stays in the flow, `invisible`, with `display: contents`
so a chip's label-and-count keep their flex gap; the spinner is centred over it.
The button keeps its exact width — swapping the label for the spinner, as
`Button loading` does, would shrink a link mid-click.
