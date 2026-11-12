# web / components/layout/page-slot

Parent: [web/components/layout](README.md)

## `apps/web/src/components/layout/page-slot/page-slot.tsx`

### `export function PageSlot({ children }: PageSlotProps)`

Every layout that frames its page in an element (`PublicShell`'s `<main>`, the
admin, dealer and sales consoles' `<main>`, the auth layout's `<div>`) puts the
page in a `PageSlot`, never straight inside the element. It renders a keyed
`Fragment`, so it adds no element and changes no markup.

**Why.** The page under a layout reaches the browser as a lazy value in the
streamed page data, and it resolves only once the page's client code has
loaded. On a slow connection that is a moment after React has started
hydrating. When the lazy value was a direct child of `<main>`, React paused on
it, and when it resolved a moment later React re-ran `<main>` from the start
without moving its place in the server HTML back. It then found the page's own
first `<div>` where `<main>` should be, raised **#418** ("server rendered HTML
didn't match the client") and rebuilt the whole document in the browser, `<head>`
included. On production that was 2–6 loads in 8 on `/contact`, `/dealers` and
car pages, and it cost every affected visit a full client re-render.

What was measured, on a production build served locally with Chrome's network
throttled (80 ms latency):

- A patched React recorded the mismatch at `<main>`, with `<main>`'s first
  server child (the page `<div>`) as the node found, no client children under
  `<main>`, and `<main>`'s `children` a lazy value already fulfilled: late, not
  wrong.
- Same build, wrapper toggled at request time: 0 of 48 loads failed on
  `/dealers` and a car page with the keyed Fragment, 8 of 48 without. The
  pre-rendered home page and `/contact` were 0 of 24 each with it.
- An unthrottled run never fails, which is why `next start` on a fast machine
  never showed it, and the development build does not reproduce it either.

That React re-runs `<main>` without resetting its hydration position is
inferred from the probe, not read in React's source. jsdom does not reproduce
the timing with either React 19.3 or Next's bundled build, so the unit test
pins the shape (a keyed Fragment, used by every framing layout) rather than the
race.

**Why a Fragment and not `<Suspense>`.** A Suspense boundary around the page
also stops the error, 0 in 96 loads, but it makes the shell stream ahead of the
page. Then a `notFound()` in the page is answered 200, not 404: measured on
`/car/…`, `/dealers/…` and `/used-cars/…`. That is the reason
[`(public)`](<../../app/(public).md>) has no `loading.tsx`. A keyed Fragment
changes neither streaming nor status codes: the same pages still answer 404,
and the server HTML has the same structure (no new streamed placeholders, the page content in place). React pauses and re-runs the
Fragment, which claims no element of its own, so there is no position to lose.

**The key matters.** An unkeyed Fragment is flattened into its parent's
children, which puts the lazy value straight back under `<main>`. `PAGE_SLOT_KEY`
keeps it a Fragment fiber of its own.
