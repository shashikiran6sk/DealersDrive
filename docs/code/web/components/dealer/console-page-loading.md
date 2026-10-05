# web / components/dealer/console-page-loading

Parent: [web/components/dealer](README.md)

## `apps/web/src/components/dealer/console-page-loading/console-page-loading.tsx`

### `export function ConsolePageLoading`

`app/(dealer)/dealer/loading.tsx` (**R101**). The console's pages are all
`force-dynamic`; without a loading boundary Next has nothing to prefetch for them,
so a sidebar click waited for the whole server render before anything moved.

With the boundary, `<Link>` prefetches the console route down to this skeleton,
and a click paints it within a frame — measured 30–63ms against 230–400ms before,
at 150ms per API call. The sidebar, the top bar and the credit card are the
layout's and stay mounted: only `main` swaps.

The boundary sits at `dealer/`, above every console page, so sibling navigations
(Inventory → Enquiries) show it too. It is one generic shape — heading, sub-line,
a card of lines — on the pages' own padding, so it reads as "this page is coming"
without pretending to be any one of them.

**The 300ms floor.** React 19 throttles the reveal of content that replaces a
Suspense fallback to at most one commit per ~300ms (`FALLBACK_THROTTLE_MS`). On a
fast local API the content therefore lands ~100ms later than it did without a
boundary (≈350ms vs ≈250ms). On production latency, where these pages took one
to three seconds, the floor is never reached. The trade was taken deliberately:
feedback in 40ms is worth more than content 100ms sooner on a laptop.
