# sandbox / stories/ui

Parent: [sandbox](../../README.md)

The notes below belonged to the files named under each heading. Each heading is the
declaration the note sat above.

## `apps/sandbox/src/stories/ui/button.stories.tsx`

### `const meta =`

The component 75 % of the product's buttons currently bypass — 29 uses of
`<Button>` against 88 raw `className="btn …"` sites. Every variant and size
is rendered below so there is never a reason to hand-roll one.

### `export const Variants: Story =`

All five variants together — the whole vocabulary in one look.

### `export const Sizes: Story =`

Five sizes, each named for where it is used.

### `export const Loading: Story = { args: { loading: true, variant: 'primary' } }`

`loading` implies `disabled` and sets `aria-busy`.

### `export const Block: Story =`

Full width, for sheets and the auth form.

### `export const LongLabel: Story =`

Long labels must not clip or wrap mid-word.

### `export const AsLink: Story =`

`ButtonLink` renders an anchor with identical styling — for navigation, where
a `<button>` would break middle-click and open-in-new-tab.

## `apps/sandbox/src/stories/ui/dialog.stories.tsx`

### `function DialogDemo(`

DESIGN-SPEC §2.14 — the modal dialog, **new at R22**.

## Why it is new when the CSS is not

`.dialog` and `.dialog-backdrop` have been in the baseline's stylesheet
throughout, with **zero consumers** — the baseline's one real dialog is drawn
with Radix (component-map finding **D-C**). Two dialog strategies, one of them
dead, and the next person with a dialog to build picking whichever they found
first. The same document's recommendation was that `Dialog` be among the first
shared components created, at the moment its first consumer lands. That
moment is R22 and `LocationSelector`.

It is Radix underneath and the design system on top. The list of things a
modal has to get right is longer than it looks and every item on it is a bug
only a keyboard or screen-reader user meets: focus into the panel, focus
trapped inside it, focus back on the trigger on the way out, the document
behind it inert, the body's scroll locked. Re-writing that would be writing it
worse.

## What to check by eye

· **7px corners** — the one radius above 4 in the product (§4.3) — and the
shadow, one of three the product allows at all (§4.1). Nothing _inside_
a dialog gets one.
· **The backdrop** is `rgba(43,43,45,0.5)`: the page stays legible behind
it and stops competing.
· **Tab is trapped.** Hold Tab down and watch focus cycle inside the panel
rather than walking into the page behind it.
· **Escape closes it, and focus lands back on the button that opened it.**
This is the one that needs the trigger to go through Radix — a modal
`Content` restores focus to _its_ trigger, so a button Radix does not
know about leaves focus on `<body>`.
· **200ms fade, and nothing else** (§1.7 `sheet`). No slide, no scale.
· **Mobile 375** — `min(440px, 100%)` inside a 13.6px backdrop padding, so
it never touches the edges and never overflows.

### `export const Default: Story = {}`

§2.14 as drawn: 440px, a title, a line of body and two actions.

### `export const WithDescription: Story =`

With the supporting line, which is also the dialog's `aria-describedby`.

### `export const Wide: Story =`

The content-heavy case — 880px, a body long enough to scroll, and a footer
that stays put. This is the shape `LocationSelector` uses, and the reason
`className` overrides the width rather than the width being fixed at 440.

### `export const NoFooter: Story = { args: { withFooter: false } }`

No footer: the ✕ and Escape are the whole of the way out.

## `apps/sandbox/src/stories/ui/otp-input.stories.tsx`

### `function Harness(`

C075 — one box per digit (**R39**).

DESIGN-SPEC §2.3: 52×58 cells, 22px tabular. A single `<input maxlength="6">`
would give the same behaviour for free and is the right control for most
products; the cells are what this design asks for, so the keyboard work is
paid for once, here.

── Three things to check by eye ────────────────────────────────────────────

· **Type.** Focus moves forward on each digit. Backspace on a filled box
clears it; on an empty one it steps back and clears the one it lands on
— one key either way, which is what somebody correcting a mistyped digit
expects.
· **Paste six digits into any box.** All six fill. This is not a nicety:
`autocomplete="one-time-code"` sits on the _first_ box, so a phone
offering the code from the SMS fills that one with the whole code, and
without this it would be crammed into a single cell.
· **The invalid state.** Every box turns together, because the code is one
value rather than six.

### `export const Invalid: Story = { args: { initial: '731904', invalid: true } }`

What a refused code looks like: the digits stay, so they can be read back.

### `export const Disabled: Story = { args: { initial: '731904', disabled: true } }`

Every attempt spent — the only way on is a fresh code.

## `apps/sandbox/src/stories/ui/plate.stories.tsx`

### `const meta =`

The registration plate — the signature element, and it belongs in exactly
four places (DESIGN-SPEC §4.5): the logo, a vehicle card's year badge, the
verified-dealer chip, and the PRIMARY photo marker. It is never interactive.

The four sizes below are those four places. Rendering them together is what
stops a fifth being invented.

### `export const EverySize: Story =`

Each size next to the place it is used.

### `export const LongLabel: Story = { args: { children: 'TN 09 BX 1234', size: 'logo' } }`

The accent bar is drawn by `::before`, so it must survive a long label.

## `apps/sandbox/src/stories/ui/states.stories.tsx`

### `const meta =`

The four state primitives — DESIGN-SPEC §2.16 and §2.20. These are the
screens people see when something is missing, broken or still loading, which
is exactly when a rough edge costs the most.

### `export const EmptyLongMessage: Story =`

The message is clamped to `max-w-[46ch]`. This is the story that shows where
that clamp lands — long copy should wrap inside it, never run the full width.

### `export const Skeleton: Story =`

Static bars, no shimmer (§1.7). Motion during loading is noise.

### `export const StepperPositions: Story =`

Every position, walked through.

### `export const StepperOutOfRange: Story =`

⚠️ **A known defect, rendered on purpose.**

`Stepper` fills a bar when `index <= current`, with no upper bound. An
out-of-range `current` therefore fills _every_ bar and the control silently
claims the flow is complete — the same picture as a genuinely finished
wizard. A step count that shrinks, or an off-by-one at the last step, lands
here.

This is not fixed as part of the reconstruction: changing behaviour under
cover of a port is what the whole exercise is meant to avoid. It is rendered
so the decision is visible and can be taken on its own.

## `apps/sandbox/src/stories/ui/status.stories.tsx`

### `const meta =`

Status is never conveyed by colour alone — the label always carries it
(DESIGN-SPEC §4.15). Every scenario below is readable in greyscale.

### `export const EveryTone: Story =`

Generated from the contracts enum rather than a hand-written list, so adding
a `StatusTone` makes a new swatch appear here automatically — and a tone with
no CSS class shows up as an unstyled tag rather than passing unnoticed.

### `export const TagVariants: Story =`

`Tag` is the non-status sibling: three variants, no semantic meaning.

### `export const BannerTones: Story =`

⚠️ `Banner.tone` and `StatusTone` are two different unions — Banner takes
only ok/warn/err. That divergence is finding D-G in component-map.md and is
deliberately **not** merged here; the two are rendered together so the
difference is visible rather than surprising.

### `export const BannerShapes: Story =`

All four shapes: with and without a title, with and without children.

### `export const BannerLongText: Story =`

Long copy must wrap rather than push the action off the edge.

## `apps/sandbox/src/stories/ui/structure.stories.tsx`

### `const meta =`

The structural primitives — the frame, the identity tiles, the stat card and
the image placeholder.

### `export const BlueprintFrame: Story =`

**All four registration marks, always.** A `.blueprint` missing a corner is
the one defect DESIGN-SPEC §4.4 calls out by name, so this story exists
specifically to make a missing corner visible.

Reserved for: the hero search block, hero and gallery figures, body-type
tiles, stat and balance cards, the price block, review-summary panels, the
under-review panel, and empty states. Not for plain content cards.

### `export const BlueprintAsSection: Story =`

It can render as a section or article without losing its marks.

### `export const IdentityTiles: Story =`

`Avatar` and `LogoTile` at the sizes the product actually uses — 20 and 22
for avatars, 42 and 44 for logo tiles — with one, two and three letters.
Three letters at 20px is where the initials overflow if the font scaling
is wrong.

### `export const Stats: Story =`

Every delta tone, plus the long-value case that breaks the layout.

### `export const StatLongValue: Story =`

A value long enough to test the clamp.

### `export const ImagePlaceholder: Story =`

The fallback when a vehicle has no photograph at all. It fills its container,
so it is shown here at two aspect ratios.

## `apps/sandbox/src/stories/ui/table.stories.tsx`

### `const meta =`

DESIGN-SPEC §2.13 — the table, **new at F045**.

`.table` has existed in `globals.css` since the first stylesheet and had no
React wrapper, so the same markup was written by hand in five pages (finding
D-B). This is the first of those five in the reconstruction, which makes it
the moment the duplication costs nothing to prevent.

The story that earns its place is **Overflow**. A table wider than its column
has to scroll inside its own bordered box; a page that scrolls sideways
instead is the admin console's most common layout bug below 768px, and it is
invisible on the desktop the console is designed on. The container is part of
the component precisely so a caller cannot forget it — this scenario is how
you check that by eye rather than by trusting the prop.

### `export const Default: Story =`

The admin dealer list, which is what the component was extracted from.

### `export const SingleRow: Story =`

One row. The last row drops its bottom border, so a single-row table has no
dangling rule under it — worth seeing, because it is the only row that
exercises `tbody tr:last-child`.

### `export const Overflow: Story =`

Wider than its container. The bordered box scrolls; the page must not.
Resize the preview and check that the page itself never gains a horizontal
scrollbar — that is the whole reason the container lives in the component.

### `export const NoRows: Story =`

No rows. The component renders an empty `<tbody>` rather than a message —
"nothing here" is the page's decision, not the table's, because the wording
depends on whether a filter is applied. `EmptyState` is what the admin pages
render instead of a table when the list comes back empty.
