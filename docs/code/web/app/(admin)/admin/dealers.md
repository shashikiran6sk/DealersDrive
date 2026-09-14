# web / app/(admin)/admin/dealers

Parent: [web](../../../../README.md)

The notes below belonged to the files named under each heading. Each heading is the
declaration the note sat above.

## `apps/web/src/app/(admin)/admin/dealers/page.tsx`

### `type SearchParamsInput = Record<string, string | string[] | undefined>`

── Reconstruction slice ────────────────────────────────────────────────────
The baseline types `searchParams` as `SearchParamsInput` from `lib/url.ts`.
That file is the search-state-in-the-URL policy and belongs to **F077**; the
type itself is the literal below, so it is inlined here rather than dragging
`FACET_ORDER` and `buildSearchUrl` forward for one alias.
────────────────────────────────────────────────────────────────────────────

### `const COLUMNS: TableColumn[] = [`

DESIGN-SPEC §3.17, plus the district and state the location filter works in.

### `function one(params: SearchParamsInput, key: string): string | undefined`

A single-valued search parameter, or nothing.

### `const pendingEdits = one(params, 'pendingEdits') === 'true' ? 'true' : undefined`

R34 — the dealerships waiting on a decision about their own words.

`'true'` or absent, matching `AdminDealerQuery.pendingEdits`: a querystring
has no booleans, and `?pendingEdits=false` reading as _true_ is the shape
of bug that survives review because the URL reads correctly.

### `const tabHref = (value?: string) =>`

The status tabs have to carry the location filter with them, and the
location form has to carry the status tab. Otherwise every click on either
one silently discards the other, and an operator who has narrowed to a
district loses it the moment they look at the pending tab.

### `<div className="seg self-start">`

The counts come back with the page, so the tabs cost no second request —
and cannot disagree with the list they filter.

### `<form method="get" action="/admin/dealers" className="flex flex-wrap items-end gap-[10px]">`

Where, in three fields, narrowing from the outside in.

A plain GET `<form>`: the filter belongs in the URL, so a moderator can
send "every pending dealer in Vellore district" to a colleague as a
link, and the page stays a server component with no client JavaScript at
all. The options come from the response's own `facets`, so the filter
can only ever offer a place some dealership is actually in — and they
are not narrowed by the current selection, which is what stops a state
choice from emptying the district list and stranding the operator.

### `{status ? <input type="hidden" name="status" value={status} /> : null}`

The tab, carried through the submit rather than reset by it.

### `{pendingEdits ? <input type="hidden" name="pendingEdits" value="true" /> : null}`

And the R34 filter, for the same reason.

### `{state || district || city ?`

Clear drops the three location fields and keeps the status tab —
`tabHref` is the wrong helper here, because its whole job is to carry
the location through.

### `<Link`

R34 — the one filter that is a piece of work rather than a place.

A toggle rather than a fourth select, and pushed to the end of the
row: it answers a different question from the three beside it. Those
narrow _where_; this one asks _what is waiting for me_. It keeps the
location filters when it is turned on, because "pending edits in
Vellore district" is a real thing to want.

### `{dealer.hasPendingProfileEdit ?`

R34. Under the name rather than in a column of its own: it is
true of very few rows at any moment, and a column that is
empty on forty-nine rows out of fifty costs every row width to
say nothing.

### `function LocationFilter(`

One `<select>` of places, plus its label.

It is a function in this file rather than a component in `components/ui`
because it is three lines of markup with no state, no variants and exactly
one consumer — the sandbox exists to stop the _fifth_ hand-rolled copy of
something, not to receive the first. `select.input` is the shared style; a
new one would have been the actual duplication.
