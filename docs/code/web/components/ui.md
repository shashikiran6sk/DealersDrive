# web / components/ui

Parent: [web](../../README.md)

The notes below belonged to the files named under each heading. Each heading is the
declaration the note sat above.

## `apps/web/src/components/ui/autocomplete.tsx`

### `export interface SuggestPayload<T>`

The typeahead, with nothing dealer-shaped in it (**R43**).

── Why this is generic ─────────────────────────────────────────────────────
The directory is the first box to get suggestions and it will not be the
last: the catalogue's make/model search lands at **F077**, and it wants every
behaviour below — the 300 ms hold, the abort, the stale-answer guard, the
first row highlighted, the arrow keys, the `role="combobox"` wiring — and
exactly none of the dealer-specific parts.

So this file owns the _interaction_ and knows nothing about what is in the
list. A caller supplies a `suggest` function and a row renderer;
`DealerSearchBox` is the first, and a `VehicleSearchBox` is meant to be the
second without touching anything here. That is the D-6 lesson applied before
the duplicate exists rather than after: `.table` was hand-rolled five times
because the second author could not find the first one's work.
────────────────────────────────────────────────────────────────────────────

## The three things that make a typeahead correct

**Debounce** — the request is not made until typing stops for 300 ms. It is
the difference between one request and eight for the word "vellore".

**Abort** — when the query moves on, the request it replaced is cancelled.
The effect cleanup does it, so it happens on unmount too.

**The stale guard** — and this is the one that is usually missing. Abort does
not help once bytes are on the wire: a two-character query against a cold
cache can resolve _after_ the four-character query that replaced it, and the
dropdown then shows answers to something the buyer has already finished
typing past. So every response carries the search it answered, and an answer
that does not match what is currently being asked is dropped on the floor.

## Accessibility

The ARIA 1.2 combobox pattern, by hand rather than through Radix, because
Radix has no combobox — `Dialog` is theirs and this is not one. The input
keeps focus throughout and `aria-activedescendant` moves the screen reader's
cursor, which is what lets a buyer arrow through the list while still typing
into the box. Every row is a real element with `role="option"` and an id, so
the relationship is in the DOM rather than in a handler.

### `export interface SuggestPayload<T>`

What a suggest endpoint answers with. One shape for every typeahead.

### `search: string`

The search this payload answers.

**Load-bearing** — see the stale guard above. A source that does not echo
it back cannot be made correct on the client.

### `export interface AutocompleteSource<T>`

Everything the interaction needs to know about the rows it is moving through.

### `suggest: (search: string, signal: AbortSignal) => Promise<SuggestPayload<T>>`

Fetch suggestions for `search`. Must honour `signal`, and must echo the
search back in the payload.

### `keyOf: (item: T) => string`

A stable React key, and the suffix of the option's DOM id.

### `valueOf: (item: T) => string`

What the input should read once this row is chosen.

### `export type AutocompleteStatus = 'idle' | 'loading' | 'ready' | 'error'`

Where the dropdown is in its lifecycle. Rendered, not inferred from truthiness.

### `export const SUGGEST_DEBOUNCE_MS = 300`

How long to wait for typing to stop.

300 ms is the usual answer and it is the right one: below about 150 ms the
saving disappears on anything but a hunt-and-peck typist, and past about 400
the list visibly lags the caret. It is a constant rather than a prop because
a box that felt different from the box on the next page would be a worse
product than either setting.

### `export const SUGGEST_MIN_CHARS = 1`

The shortest input worth asking about.

One character. It is a low bar deliberately — "MG" is a marque and several
dealerships trade under two letters — and the endpoint is shaped to answer
cheaply enough that the first keystroke is not special.

### `search: string`

The search these items answer — what the highlighter marks.

### `clear: () => void`

Clears the box and closes the list, without choosing anything.

### `search: string`

The characters the rows matched — pass to `HighlightedText`.

### `highlighted: number`

Index into `items`. Always 0 after a fresh answer; -1 when there are none.

### `choose: (item: T) => void`

Chooses a row: fills the input, closes the list, calls `onSelect`.

### `inputProps:`

Spread onto the `<input>`. Carries the combobox ARIA and the key handling.

### `listProps: { id: string; role: 'listbox' }`

Spread onto the listbox element.

### `optionProps:`

Spread onto each row. `index` is its position in `items`.

### `onSelect: (item: T) => void`

A row was chosen — by Enter, or by a click.

### `onClear?: () => void`

The box was emptied. Separate from `onSelect` because it is the opposite.

### `const chosen = useRef<string | null>(null)`

The value this box wrote into itself by choosing a row.

Choosing "Vellore Cars" sets the input to "Vellore Cars", which is a change
to `value`, which would debounce into a request for the exact name that was
just chosen — and then reopen the dropdown over a page that is already
navigating. A ref rather than state because nothing renders from it, and
because it must be true _before_ the effect below runs rather than after
the next paint.

### `const sourceRef = useRef(source)`

`source` is almost always an object literal, so it is a new reference every
render and cannot go in the dependency list without refetching on each one.
The effect wants the _current_ source, and a ref is how you say that.

### `if (payload.search.trim() !== debounced) return`

The stale guard. `payload.search` is what the server answered; a
reply to anything but the question currently being asked is dropped
rather than rendered. This is what `abort` cannot do — see the
docblock at the top.

### `setHighlighted(0)`

A fresh answer always highlights its first row: the whole promise of

### `setHighlighted(0)`

this control is that Enter does the obvious thing without arrowing.

### `if (controller.signal.aborted) return`

An abort is this component cancelling itself, not a failure. Showing

### `if (controller.signal.aborted) return`

"something went wrong" because a buyer typed another character would

### `if (controller.signal.aborted) return`

make fast typing look broken.

### `const activeIndex = items.length === 0 ? -1 : Math.min(highlighted, items.length - 1)`

-1 rather than 0 when the list is empty, so `items[highlighted]` is

### `const activeIndex = items.length === 0 ? -1 : Math.min(highlighted, items.length - 1)`

undefined rather than accidentally meaningful.

### `setHighlighted((current) => (current + delta + items.length) % items.length)`

Wraps, as the UI reference does: past the last row is the first one.

### `if (open && activeItem !== undefined)`

**Enter uses whatever is highlighted**, which after every fresh
answer is the first row — so the common case is: type, pause, Enter.
Nothing is "selected" in the sense of having been clicked, and that
is the point of the default highlight.

`preventDefault` only when there is something to choose, so this stays
a normal key inside whatever form may one day wrap the box.

### `if (open)`

Closes the list and keeps what was typed — Escape is "stop showing me

### `if (open)`

this", not "undo what I wrote".

### `setOpen(false)`

Leaving the box abandons the suggestion. Choosing on blur is the

### `setOpen(false)`

behaviour that makes people distrust these controls.

### `onMouseDown: (event) => event.preventDefault()`

The click has to survive the blur. `mousedown` fires first and would
take focus off the input, and a blur handler that closes the list would
unmount the row before `click` ever reached it — the classic dropdown
bug where the first click does nothing.

### `export function HighlightedText({ text, match }: { text: string; match: string }): ReactNode`

The typed characters, marked inside a label (**R43**).

Case-insensitive, and it marks **every** occurrence: "Vellore Star Auto" on
"a" should not underline one `a` and leave the others plain, which reads as a
rendering fault rather than a match.

`<mark>` rather than a styled `<span>` because that is what the element is
for, and because a screen reader announces it. The styling is the design's —
accent, bold, underlined, no highlighter background (`DESIGN-SPEC` §3.5 and
the UI reference) — so it reads as emphasis rather than as a selection.

When the text does not contain the search at all it renders unmarked, which
is the correct answer for a row matched on its town rather than its name.

### `export function AutocompletePanel<T>(`

The shell every typeahead draws: the bordered input row, and the panel under
it (`DESIGN-SPEC` §3.5, and the Search-Bar UI reference).

It renders the four states a remote list actually has — loading, error,
nothing found, and rows — because each of them is a different sentence and
collapsing any two of them lies to somebody. "No dealerships match" shown
while the request is still in flight is the most common version of that lie.

The rows themselves are the caller's: `children` receives the hook, so a
dealer row and a vehicle row can look entirely different while the panel,
the states and the keyboard stay one implementation.

### `label: string`

The visually-hidden `<label>`. Never a placeholder standing in for one.

### `groupLabel: string`

The uppercase heading over the rows — "Dealerships in Vellore district".

### `emptyMessage: (search: string) => string`

What to say when the search matched nothing. Gets the search back.

### `useEffect(() =>`

A click anywhere else closes the panel. `pointerdown` rather than `click`
so the panel is gone before the thing underneath reacts, and on the
document rather than via a blur handler because focus never leaves the
input — that is the combobox pattern, and a blur-based close would fire on
a scrollbar drag.

### `onClick={autocomplete.clear}`

Not a submit, and not in the tab order ahead of the list: it is a

### `onClick={autocomplete.clear}`

convenience for a pointer, and Escape plus select-all is the

### `onClick={autocomplete.clear}`

keyboard's way to the same place.

### `<div {...autocomplete.listProps} className="px-[12px] py-[14px] text-[13px]">`

One row, saying which of the three non-list states this is. It
still carries the listbox role: a screen reader that was told the
box controls a list should not find that the list has vanished.

## `apps/web/src/components/ui/button.tsx`

### `const button = cva('btn'`

DESIGN-SPEC §2.1 and §4.7.

One `btn-primary` per view — the single forward action. `btn-secondary` for
alternate paths of equal weight, `btn-ghost` for navigation and low-stakes
affordances. Never a primary inside a table row, except the moderation
queue, where approving is the queue's whole purpose.

### `default: ''`

Natural ≈32px: headers, toolbars.

### `sm: 'text-[12px] px-[10px] py-[4px]'`

In-card, table and chip actions.

### `md: 'h-10 text-[14px]'`

VDP secondary pair, onboarding next.

### `lg: 'h-11 text-[15px]'`

VDP primary CTA, auth submit, sheet CTA.

### `hero: 'h-12 px-[26px] text-[15px]'`

Hero search CTA.

### `loading?: boolean`

Keeps width, swaps the label for a spinner, sets aria-busy (§2.1).

## `apps/web/src/components/ui/dialog.tsx`

### `export function Dialog(`

DESIGN-SPEC §2.14 — the modal dialog, and the product's only 7px radius.

## Why this exists, and why it is Radix underneath

`component-map.md` finding **D-C**: the baseline shipped `.dialog` and
`.dialog-backdrop` in `globals.css` with **zero consumers**, and drew its one
real dialog with `@radix-ui/react-dialog`. Two dialog strategies, one of them
dead — and the recommendation in the same document was that `Dialog` be among
the first shared components created, at the moment its first consumer lands.
That moment is **R22**, and this is it.

Radix rather than a hand-rolled trap because the list of things a modal has
to get right is longer than it looks and every item on it is a bug a screen
reader user hits and nobody else does: focus into the panel on open, focus
_trapped_ while it is there, focus back on the trigger when it closes —
whether by Escape, by the close button or by a click on the backdrop —
`aria-modal` with the rest of the document inert, and the body's scroll
locked so the page underneath does not slide about behind it. Writing that
again would be writing it worse; it is already a dependency, and it is the
strategy the baseline chose.

What this component owns is the _design_: the backdrop tint, the 7px corner,
the one shadow, and the fact that `.dialog` finally has something rendering
it. §4.1 — one of three elements in the product allowed a shadow.

## The width is a default, not a rule

§2.14 specifies `min(440px, 100%)`, which is right for the two dialogs the
spec draws — a confirmation and a rejection reason. A dialog whose content is
a grid is a different object, and passing `className` overrides the width the
way any Tailwind utility overrides a component class. `LocationDialog` does
exactly that; a confirm dialog should not.

## Motion

§1.7 `sheet` — 200ms `ease-out`, fade only. `prefers-reduced-motion` zeroes
every duration globally in `globals.css`, so there is nothing to opt out of
here.

## Open state is controlled, and the trigger still goes through Radix

`open`/`onOpenChange` are the caller's, because most dialogs close for a
reason of their own — a choice made, a request that succeeded — and not only
because somebody pressed ✕. The `trigger` still has to be Radix's; see the
prop for why, and for the bug that is not obvious until a keyboard user hits
it.

### `trigger: ReactNode`

The control that opens it, rendered as-is through `Trigger asChild`.

It goes through Radix rather than being a button the caller wires up
itself, and that is not a stylistic preference: a modal `Content` cancels
the focus-scope's own restore and focuses **its trigger** instead, so a
dialog opened by a button Radix does not know about closes with focus on
`<body>` — the next Tab starts from the top of the document. Passing the
button here is what makes "focus goes back where it came from" true, and it
gets `aria-haspopup="dialog"` and `aria-expanded` for nothing besides.

### `title: string`

The accessible name. Rendered visibly unless `header` replaces it.

### `description?: string`

Optional supporting line under the title, and the accessible description.

### `closeLabel?: string`

The icon-only close button's `aria-label` — §4.15 requires one.

### `className?: string`

Overrides on the panel: width, padding, layout.

### `contentClassName?: string`

The scrolling region between header and footer.

### `header?: ReactNode`

Replaces the default title block. It still has to _contain_ the title —
pass `<DialogTitle>` — because `aria-labelledby` points at it.

### `footer?: ReactNode`

Pinned below the scrolling region.

### `aria-modal="true"`

Radix makes the rest of the document inert with `aria-hidden` and
does not set this itself. Both are the same claim; a checker looking
for the attribute should find it, and a reader of this file should
not have to know which of the two mechanisms is in play.

### `'fixed top-1/2 left-1/2 z-71 max-w-[calc(100vw-28px)] -translate-x-1/2 -translate-y-1/2'`

The panel centres _itself_, and that is not a stylistic choice.
§2.14 describes `.dialog-backdrop` as a centring grid with the
`.dialog` inside it — but Radix portals the overlay and the
content as **siblings**, so `place-items: center` on the backdrop
never reaches the panel and it lands wherever the portal put it.
The transform reproduces what the spec's grid would have done, and
`calc(100vw - 28px)` is its 13.6px padding on each side, so the
panel never touches the edge of a phone.

`z-71` for the same reason: siblings, so the backdrop's `z-index:
70` paints _over_ a panel at `auto`, and the whole dialog renders
behind its own 50 % tint — legible, greyed, and wrong in a way
that is easy to read as a colour mistake rather than a stacking
one.

### `'dialog max-h-[calc(100svh-28px)] gap-0 overflow-hidden p-0'`

Capped in `svh` rather than `vh`: on a phone the browser chrome is
part of `vh`, so a dialog sized to it puts its own footer under
the address bar.

`p-0`/`gap-0` because the panel is header + scroller + footer, each
with its own padding and separated by a hairline. §2.14's 13.6px
padding is right for a dialog that is one block of prose.

### `<RadixDialog.Close`

Icon-only, so it needs a name (§4.15). 36×36 is `btn-icon`, which
is already the 44px minimum's nearest legal size in a header row —
the hit area is padded out to it below 768 by the class itself.

### `export function DialogTitle({ children, className }: { children: ReactNode; className?: string })`

The dialog's accessible name, and 16px/600 heading per §2.14.

Exported because a custom `header` still has to carry it: Radix points
`aria-labelledby` at this element, and a dialog with no name is announced as
"dialog" and nothing else.

### `export function DialogDescription(`

The supporting line, and the dialog's `aria-describedby`.

## `apps/web/src/components/ui/input.tsx`

### `export function Input({ className, ...props }: ComponentPropsWithRef<'input'>)`

The `.input` class as a component.

── Why this exists ─────────────────────────────────────────────────────────
This is the one component in F009–F013 that is **not** a port. DESIGN-SPEC
§2.3 defines the control, and `globals.css` has always carried `.input` —
but the baseline has no React wrapper for it, so `className="input"` is
written by hand at **70** call sites (audit finding D-B).

That is the same failure that produced a 75 % `Button` bypass rate and five
hand-rolled `.table` implementations: the CSS existed, the component did
not, and everyone reached for the class. Creating it here — before those 70
sites are reconstructed — is the point at which that is cheap to prevent
rather than expensive to undo.

`Input`, `Textarea` and `Select` are three components rather than one
polymorphic control because `.input`, `textarea.input` and `select.input`
are three different rules in the stylesheet, and because a caller should get
the right DOM element's props typed.

### `export function Input({ className, ...props }: ComponentPropsWithRef<'input'>)`

`ComponentPropsWithRef` rather than `InputHTMLAttributes` so a caller can hold
the element (**R37**): `ServiceInput` returns focus to the draft box after
every chip, and in React 19 `ref` is an ordinary prop on a function component
— it is only the type that had to widen. Nothing else about the component
changes, and no existing call site is affected.

## `apps/web/src/components/ui/otp-input.tsx`

### `export function OtpInput(`

DESIGN-SPEC §2.3 — one box per digit, 52×58, 22px tabular (**R39**).

`'use client'` for the obvious reason: this is nothing but keyboard
behaviour. What that behaviour has to get right is the part people notice
only when it is missing —

· typing moves forward, Backspace on an empty box moves back and clears
the one it lands on, so correcting a mistyped digit is one key;
· pasting six digits into _any_ box fills all six, because that is what
the "copy code" affordance on both iOS and Android actually produces;
· `autocomplete="one-time-code"` on the first box, which is what lets a
phone offer the code from the SMS above the keyboard. Six separate
inputs would ordinarily forfeit that — the attribute goes on the first
one and the paste handler below turns the autofill into six digits.

A single `<input maxlength="6">` would give all of that for free and is the
right control for most products. The cells are what the design asks for here,
so the cost is this file, paid once.

The value is owned by the caller. This renders `value`, split — there is no
second copy of the code living in six pieces of DOM state that could
disagree with the one being submitted.

### `value: string`

The digits typed so far, `''` to `length` characters.

### `onComplete?: (value: string) => void`

Fired once the last box is filled — the design's "verify as you finish".

### `const next = (value.slice(0, index) + digits + value.slice(index + digits.length)).slice`

More than one digit in one box means an autofill or a paste landed here.

### `const target = value[index] ? index : index - 1`

On a filled box, clear it. On an empty one, step back and clear that —

### `const target = value[index] ? index : index - 1`

which is what a person who has just noticed the wrong digit expects.

### `autoComplete={index === 0 ? 'one-time-code' : 'off'}`

Only the first box carries it: a phone offering the code fills the

### `autoComplete={index === 0 ? 'one-time-code' : 'off'}`

field it is on, and `handleInput` spreads the six digits from there.

## `apps/web/src/components/ui/primitives.tsx`

### `const plate = cva('dd-plate'`

The primitives. Nothing in this file knows what a vehicle is — anything that
imports a domain type belongs in `components/vehicle/` instead, which is what
keeps `ui/` promotable to `packages/ui` later (ARCHITECTURE §16.4).

── Reconstruction note ─────────────────────────────────────────────────────
This file holds 14 primitives in the baseline and is built up across four
PRs, each adding the components it owns together with their CSS layer:
F009 Plate
F010 StatusTag, Tag, Banner
F011 Blueprint, Corners, StatCard, ImageSlot, Avatar, LogoTile
F012 EmptyState, ErrorState, SkeletonLines, Stepper ← this PR

### `const plate = cva('dd-plate'`

The registration plate — the signature element, in exactly four places:
the logo, a vehicle card's year badge, the verified-dealer chip, and the
PRIMARY photo marker (DESIGN-SPEC §4.5). It is never interactive.

### `year: ''`

Year badge — the default.

### `logo: 'text-[12px] font-semibold py-[3px] pr-[9px]'`

Logo, in headers and sidebars.

### `chip: 'text-[10px]'`

Verified-dealer chip.

### `marker: 'text-[9px]'`

PRIMARY marker on the wizard's first photo tile.

### `export function StatusTag(`

Status is never conveyed by colour alone — the label always carries it (§4.15).

### `export function Banner(`

DESIGN-SPEC §2.15 — cleared on navigation, never auto-dismissed.

### `export function Blueprint(`

The blueprint frame. All four registration marks, always — a `.blueprint`
missing a corner is the one thing DESIGN-SPEC §4.4 calls out by name.

Reserved for: the hero search block, hero and gallery figures, body-type
tiles, stat and balance cards, the price block, review-summary panels, the
under-review panel, and empty states. Not for plain content cards.

### `export function Corners()`

The four registration marks on their own, for the places where the blueprint
frame has to be an element `Blueprint` cannot render — the gallery's main
image is a `<button>`. Anything carrying `.blueprint` must carry these.

### `export function Avatar(`

Square avatars. `border-radius: 50%` appears nowhere in this product
(DESIGN-SPEC §4.3) — the monogram sits in a cobalt-tinted square.

### `export function LogoTile(`

The larger logo tile variant, on a lighter tint with a hairline.

### `export function StatCard(`

DESIGN-SPEC §2.12 — blueprint, eyebrow, tabular stat, delta line.

### `export function ImageSlot({ label, className }: { label: string; className?: string })`

A placeholder panel naming the shot, exactly as the prototype renders one.

### `export function EmptyState(`

DESIGN-SPEC §2.20 — every list has one: a blueprint shell, one sentence
naming what is missing, and one primary recovery action.

### `export function SkeletonLines({ className }: { className?: string })`

Static bars at the widths DESIGN-SPEC §2.20 specifies. No shimmer.

### `export function Stepper(`

DESIGN-SPEC §2.16 — onboarding and the add-vehicle wizard share it.

## `apps/web/src/components/ui/service-input.tsx`

### `export interface ServiceInputProps`

DESIGN-SPEC §2.5 — the services list, entered one service at a time (**R37**).

── Why this exists ─────────────────────────────────────────────────────────
`specialities` is an array in the contract and was a comma-separated text box
on both screens that write it. That asked the dealer to hold a serialisation
format in their head — is a comma inside a service name allowed? does a
trailing comma make an empty one? — and it hid the one fact they most need to
see, which is _how many services they have named and which_. A dealer
reviewing `Finance, exchange, RC transfer, in-house workshop, insurance` in a
single-line input is reading their own answer through a keyhole.

Buyers already see this list as chips, on the directory card and on the
portfolio. So does the admin review screen. This makes the editor the same
picture: **what you are building is what a buyer will see.**

── How it submits ──────────────────────────────────────────────────────────
A hidden input carries `services.join(', ')` under `name`, which is exactly
what the comma-separated box submitted. `servicesOf()` in the two server
actions is unchanged and still the single parse — so the wire format, the
contract and the API are untouched by this component, and a screen that has
not adopted it yet cannot disagree with one that has.

The visible text box has **no `name`**: it is the draft, not the value, and a
draft must not be submittable. That is the same rule `LockedField` relies on
(R27) and it is what makes the hidden input the only thing that speaks.

### `id: string`

Labels the visible draft box, so the `<Field>`'s label points at it.

### `name?: string`

The form key. `undefined` submits nothing — the R34 waiting-for-review lock.

### `required?: boolean`

Blocks submit with the browser's own message while the list is empty.

### `const latest = useRef({ services, draft })`

The draft is read by the submit listener below, which is a native DOM
handler and therefore sees whatever was current when it was attached
rather than whatever is current when it fires. A ref is the value that
moves; the state is the value that renders.

### `const add = useCallback`

One entry, or several when a comma-separated string is pasted in.

Splitting on paste is not a convenience — it is the reason a dealer who
copies their service list out of WhatsApp does not end up with one chip
sixty characters long that the contract then refuses.

### `const next = [...latest.current.services]`

Computed from the ref rather than inside a `setServices` updater. An
updater does not run until React renders, so the three counters below
would still be zero when the message is chosen and when this function
returns — which is the difference between "already added" and silence,
and between keeping the dealer's text and clearing it.

### `if (next.some((existing) => existing.toLowerCase() === entry.toLowerCase()))`

Case-insensitively, because "RC transfer" and "RC Transfer" are one

### `if (next.some((existing) => existing.toLowerCase() === entry.toLowerCase()))`

service and a buyer comparing two dealerships should not see both.

### `return !(duplicates === entries.length || overLength === entries.length)`

Every entry was refused, so the box keeps what the dealer typed: there

### `return !(duplicates === entries.length || overLength === entries.length)`

is nothing to retype and the message says what to change.

### `useEffect(() =>`

A service typed but not added is still a service the dealer meant to add.

Without this, the most natural mistake on the screen — type, then press
Continue — silently discards the last thing they wrote, and the failure is
invisible until they look at their own public page. Writing the hidden
input's `value` directly is what makes the fix work: a `setState` here
would not have flushed before the form serialises.

### `required={required && services.length === 0}`

`required` only while the list is empty, and on the _draft_ box
rather than on the hidden input: the browser cannot focus or
message a hidden control, so the native refusal would have been a
form that silently would not submit.

### `if (event.target.value.includes(','))`

A typed or pasted comma means the entry is finished.

### `event.preventDefault()`

Otherwise Enter submits the whole onboarding step, which is the

### `event.preventDefault()`

opposite of what pressing it in this box means.

### `<div`

A `group` rather than a `list`, deliberately. The chips are the same
picture the directory card draws and that row is not a list either —
and every onboarding step already contains one `<ol>`, the stepper, so a
second list role here makes `getByRole('list')` ambiguous on a screen
whose only list is meant to be the progress indicator.

`aria-live` because adding a chip changes this row without moving focus:
a screen reader is told what happened rather than having to be steered
back to find out.

### `<Tag key={service} variant={index === 0 ? 'accent' : 'neutral'}>`

The first chip takes the accent, which is the rule the directory
card renders by (**R29**) — so the editor and the card are not only
the same shape but the same picture.

## `apps/web/src/components/ui/table.tsx`

### `export interface TableColumn`

The `.table` class as a component (DESIGN-SPEC §2.13).

── Why this exists ─────────────────────────────────────────────────────────
Like `Input` at F013, this is **not** a port. `globals.css` defines `.table`
and the baseline has no React wrapper for it, so the same markup is written
out by hand in five pages — dealer inventory, billing, admin payments, admin
listings and admin dealers (audit finding D-B). Five independent renderings
of one design-spec component is exactly the duplication the reuse rule
exists to prevent, and this page is the first of the five in the
reconstruction: the cheapest possible moment to stop it at one.

── What it carries that the raw markup does not ────────────────────────────
The **scroll container is part of the component**, not the caller's problem.
A table wider than its column has to scroll inside its own bordered box,
because a page that scrolls sideways instead is the admin console's most
common layout bug below 768px — and it is invisible on the desktop the
console is designed on. All five hand-rolled sites wrap the table in the
same `overflow-x-auto` div; one of them forgetting is a matter of time.

It stays deliberately thin. `columns` describes the header and the body is
whatever the caller renders, because a table that owned its rows would need
a render prop per cell and all five pages format their cells differently.
The rendered markup is byte-for-byte what those pages write today.

### `align?: 'left' | 'right'`

Right-aligned — the row's action link, at the end of the row.

### `thProps?: ThHTMLAttributes<HTMLTableCellElement>`

Passed through for a column that needs, say, an explicit width.

### `caption?: string`

A description for screen readers when the heading above is not enough.

### `containerClassName?: string`

Applied to the scroll container, not the table.

### `export function NumericCell(`

A cell holding a number. `tabular-nums` is mandatory on counts, balances and
prices (§4.2) — digits that do not line up down a column are the difference
between a table you can scan and one you have to read.

It is a component rather than a `numeric` flag on the column because the
header and the cells are rendered by different people: `Table` owns the
`<th>`, the caller owns the `<td>`.
