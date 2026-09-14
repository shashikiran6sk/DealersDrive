# web / styles

Parent: [web](../README.md)

The notes below belonged to the files named under each heading. Each heading is the
rule the note sat above.

## `apps/web/src/styles/globals.css`

### `@theme`

Dealers-Drive design system.

Transcribed from `docs/DESIGN-SPEC.md` and the prototype's own stylesheet
(`docs/Dealers-Drive-UI/ds/industry.css` plus the `:root` overrides in
`Dealers-Drive.dc.html`). The prototype is the source of truth for anything
visual, so the component classes below carry the same names and the same
values it uses — `.btn`, `.card`, `.tag`, `.dd-plate`, `.blueprint` — and
Tailwind utilities handle layout on top.

Three rules govern the whole system and are worth stating once:
· Square corners are the default. Radius 0 everywhere (§4.3).
· Depth comes from 1px hairlines, not shadows. Exactly three elements
carry a shadow: the city dropdown, the dialog, the mobile sheet (§4.1).
· Cobalt is the only decorative colour. Green/amber/red are status, never
emphasis (§4.8).

### `--color-accent-100: #eef2ff;`

── cobalt: the brand, and the only decorative colour

### `--radius-md: 4px;`

Square is the product default (§1.5, §4.3). The only rounded things are the
four inherited base classes: `.btn` / `.input` / `.card` / `.seg` at 4px,
`.tag` at 3px, `.dialog` at 7px. Everything authored — plates, image
frames, thumbnails, stat tiles, tables, badges, banners, avatars, lightbox
chrome, arrows — stays at 0.

### `--shadow-lg: 0 12px 32px rgb(43 43 45 / 0.22);`

Only three elements in the product carry one (§4.1).

### `@layer base`

── base

### `:focus`

Focus is never removed, only restyled (§4.15).

### `@media (prefers-reduced-motion: reduce)`

prefers-reduced-motion → all 0ms (§1.7).

### `@layer components`

── Reconstruction note ─────────────────────────────────────────────────────
`@layer components` is built up one block at a time, each arriving with the
React component that wraps it, so a class and its component land together
and neither can be added without the other being reviewed:
F009 .btn*, .dd-plate
F010 .tag*
F011 .blueprint, .corner, .card, .image-slot
F012 .skeleton
F013 .field, .input
F045 .table, .seg/.seg-opt
R19 .dd-nav-item
R22 .dialog, .dialog-backdrop ← this PR
`.dd-nav-item` is the exception that proves the rule, and it is why the rule
is written down: `LocationSelector` landed at R11 _using_ the class, and the
class did not land with it. Every option in the district menu has been an
unstyled `<button>` since — including the one for the district already
chosen, whose `aria-current` had nothing to colour it with.
`.dialog` is the mirror image of that mistake and is why the rule is not
"port the CSS": in the baseline the class exists and _nothing renders it_
(finding D-C), so it lands here with the `Dialog` that wears it and with the
first screen that opens one.
`.table` and `.seg` have no component at all in the baseline — that is
finding D-B. `.table` arrives here _with_ the `Table` that wraps it, at the
first of its five hand-rolled call sites. `.seg` arrives without one: the
dealer status tabs below it are `<Link>`s rather than buttons, and
`Segmented` is created at F091, where the second consumer appears.

### `.btn`

Buttons — §2.1. Natural height ≈ 32px; sizes are overridden per context.

### `/**`

Inputs — §2.3.

### `.dd-plate`

The registration plate — §2.2. The signature element, and it appears in
exactly four places: the logo, the year badge on a vehicle card, the
verified-dealer chip and the PRIMARY photo marker (§4.5). Nowhere else.

### `.tag`

Tags and status badges — §2.5.

### `.tag-draft`

Draft / Expired share the neutral fill; Expired takes the lighter ink.

### `.card`

Cards — §2.7. White on the cool grey ground; a border, never a shadow.

### `.blueprint`

The blueprint frame — §2.6. Four registration marks, always. A
`.blueprint` missing a corner is a bug the design spec calls out by name.

### `.image-slot`

Image placeholder — the prototype's `<image-slot>`. Every photograph in
the design is a flat surface panel naming the shot, and the seeded media
reproduces that; this is the fallback when a vehicle has no photo at all.

### `.skeleton`

Skeletons — static bars, no shimmer (§1.7, §2.20).

### `.input`

Inputs — §2.3.

### `.seg`

Segmented control — §2.4. Radio-group semantics, arrow keys move.

### `.table`

Table — §2.13.

### `.dd-nav-item`

Menu rows — §2.18. The district dropdown's options, and the only consumer.

Ported verbatim from the baseline (**R19**). `LocationSelector` arrived at
R11 carrying `className="dd-nav-item"` and the class itself did not come
with it, so every row rendered as a bare `<button>`: no padding, no hover,
and — the one that matters — no highlight on the district a buyer had
already chosen. `aria-current` was on the element the whole time, saying
something no eye could see.

`display: block` is overridden by the `flex` the component adds — utilities
are a later layer than components — and that is how the baseline had it
too: the block is the fallback for a row that is only text.

`.dd-nav-item-dark` is deliberately _not_ ported with it. The baseline's
admin sidebar used it; ours styles itself with utilities and says so in its
own docblock, so the variant has no consumer and would be dead the moment
it landed.

### `/*`

Dialog — §2.14, ported verbatim from the baseline (**R22**), where it had
_zero_ consumers (component-map finding **D-C**): the baseline drew every
dialog with Radix and left 24 lines of CSS describing a component nothing
rendered. Two dialog strategies, one of them dead, and the next developer
with a dialog to build picking whichever they found first.

`Dialog` resolves that rather than adding a third: Radix keeps the parts
only a library gets right — the focus trap, the scroll lock, `aria-modal`,
restoring focus to whatever opened it — and these classes are what it
wears. One strategy, and the CSS has a consumer.

7px is the one radius above 4 in the product, and the shadow is one of the
three in it (§4.1, §4.3). The width is the _generic_ dialog's; a dialog
whose content is a grid overrides it, which is what `className` is for.

### `.dialog-backdrop`

Ported verbatim, `display: grid` included — and the grid does not do the
centring. Radix portals the overlay and the panel as siblings rather than
nesting one in the other, so the panel centres itself; `Dialog` says so
where it does it. The declarations stay because this is the spec's block
and the next consumer may not be Radix's.

### `.dialog-backdrop[data-state='open'],`

§1.7 `sheet` — 200ms ease-out, a fade and nothing else. No slide, no
scale: "no entrance animations" is the rule and the dialog is the one
exception the spec grants, so it takes the smallest version of it.

The `@media (prefers-reduced-motion: reduce)` block in `@layer base`
zeroes every animation duration in the document, so there is nothing to
opt out of here.

### `.tnum`

Mandatory on prices, EMIs, KM, credit counts, stat values, filter counts,
table numeric columns, invoice amounts, ledger deltas, city counts and
gallery counters. Never on prose (§4.2).

### `.ink-body`

The text opacity ladder — §1.2, used in this order.

### `.min-w-0`

Any column holding an image strip, a table or ellipsised text (§4.12).

## `apps/sandbox/src/preview.css`

### `@import '../../web/src/styles/globals.css';`

The sandbox's stylesheet entry.

It is one line of its own on top of `apps/web/src/styles/globals.css` — the
real token sheet, never a copy — and that line is load-bearing.

Tailwind v4 discovers the classes to generate by scanning outward from the
stylesheet it is processing. Run from `apps/web` that finds the app; run from
`apps/sandbox`, which is where Vite invokes PostCSS, it does not, and every
utility class in every component silently produces nothing. The symptom is a
story that renders with its `@theme` colours but no layout at all, which
looks enough like a component bug to send someone hunting in the wrong file.

So the source root is stated rather than inferred. Stories themselves are
scanned too: a story may use a utility no component happens to use yet.
