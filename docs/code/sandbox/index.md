# sandbox / index

Parent: [sandbox](../README.md)

The notes below belonged to the files named under each heading. Each heading is the
declaration the note sat above.

## `apps/sandbox/src/registry.ts`

### `export type Category =`

The searchable component index — this is what "search the sandbox first"
actually means.

Discovery failure is the problem this repository has, measurably: `<Button>`
is used 29 times against 88 raw `className="btn …"` sites, a 75 % bypass
rate, and `.table` was hand-rolled in five separate pages. Nobody set out to
duplicate anything — they could not find what already existed.

So every entry carries `aliases`. `dealer-card.tsx` exports `DirectoryCard`,
and somebody looking for "DealerCard" must still find it (finding D-6).

### `id: string`

The component-map id, e.g. 'C032'.

### `source: string`

Repository-relative path to the real component.

### `purpose: string`

One line. What it is for, not what it looks like.

### `aliases: string[]`

Every name someone might plausibly search for. The D-6 fix.

### `features: string[]`

F-numbers that render it.

### `storyId: string`

Storybook id, for deep links.

### `export const registry: RegistryEntry[] = [`

Populated one component at a time, by the feature that brings the component
across. An entry without a story, or a story without an entry, is a gap —
see `docs/project/component-sandbox.md` §5.

### `purpose:`

It reads `usePathname()` (coupling C-3), so the pathname is the control
— one story per route rather than a knob. `items` defaults to the landed
set so the shell needs no knowledge of the slice (**F048**).

### `purpose: 'The dealer console sidebar nav. Takes its items; reads the pathname for current.'`

Items in, pathname read (coupling C-3). So `items` is a control and the
pathname is a parameter — one story per route rather than a knob.

### `purpose:`

`md:hidden`, so it is invisible at a desktop viewport — the 375 and 768
viewport controls are the only way to see it at all.

### `purpose:`

Search here before hand-rolling another bar chart. It is the only one in
the product, and `.table` being hand-rolled five separate times in the
baseline is what this registry exists to prevent.

### `aliases: [`

Finding **D-6**, and the reason this field exists. The file is
`dealer-card.tsx`, the export is `DirectoryCard`, and `DealerCard` is a
contracts DTO — so a search for the obvious name has to land here rather
than returning a type and inviting a second card.

### `props: ['step', 'session', 'documents', 'dealer', 'completeness', 'yardPhoto']`

`cities` is gone rather than pending: the `cities` table went with it,
and step 2 types its city. `yardPhoto` takes its place in the list —
step 3 renders the hero photograph alongside the KYC checklist.

### `purpose: "A dealer's proposed tagline and services, old beside new, with publish and refuse."`

The gate on the only free text a dealer writes that a buyer reads.
Renders only when something is waiting — `profileChange` is PENDING-only.

### `purpose:`

Two shapes, not one. A key something reads gets a control typed to match
it; a key nothing reads yet gets its value and a tag, because an editable
control that changes no behaviour tells an operator otherwise.

### `purpose: 'Who may open the admin console: grant access by email, withdraw a grant.'`

The one screen that hands out a cross-tenant seat. Its two refusals —
your own row, and an allow-listed address — are states worth looking at,
because both are places an operator could otherwise lock somebody out.

### `states: ['place card', 'pin only', 'directions only', 'map only', 'neither']`

Five. The first two are the map Google returns — the place card, with the
yard's name, rating and directions in the frame, against the bare pin a
link that named no place gets. The middle two are the point of the
component: the map and the button are independent, because a share link
carries neither until it is followed and following it is best-effort.

### `export function findComponent(query: string): RegistryEntry[]`

Case-insensitive search across name, aliases, purpose and category.
