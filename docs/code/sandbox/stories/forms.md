# sandbox / stories/forms

Parent: [sandbox](../../README.md)

The notes below belonged to the files named under each heading. Each heading is the
declaration the note sat above.

## `apps/sandbox/src/stories/forms/field.stories.tsx`

### `const meta =`

`Field` is the accessibility contract every form in the product inherits:
label above, control, then an 11px error message wired to the control by
`aria-describedby` (DESIGN-SPEC §2.3).

The error id is derived from the control id — `errorId(id)` — so no caller
has to invent a second convention, and `invalidProps(id, error)` returns the
three attributes an errored control needs or nothing at all.

### `export const Plain: Story =`

The four shapes: hint? × error?.

### `export const WithError: Story =`

The errored control carries `aria-invalid` and `aria-describedby` pointing
at the message — inspect the DOM here, not just the red border. Colour alone
is never the signal.

### `export const EveryControl: Story =`

Every control shape `.input` styles — `input`, `textarea.input` and
`select.input` are three separate rules in the stylesheet, which is why
there are three components rather than one.

## `apps/sandbox/src/stories/forms/service-input.stories.tsx`

### `const meta =`

C072 — the services list, entered one service at a time (**R37**).

`specialities` is an array in the contract and was a comma-separated text box
on both screens that write it. That asked the dealer to hold a serialisation
format in their head, and hid the one fact they most need to see: **how many
services they have named, and which**.

Buyers already read this list as chips, on the directory card (`DealerCard`,
C0xx) and on the portfolio; so does the admin review screen. This makes the
editor the same picture — what the dealer is building is what a buyer will
see, down to the first chip taking the accent (**R29**).

── Four things to check by eye ─────────────────────────────────────────────

· **Type and press Add, or just press Enter.** Enter must _not_ submit the
surrounding form — on onboarding that would skip a step.
· **Paste a comma-separated line.** `Finance, Exchange, RC transfer` should
land as three chips, not one. A dealer copying their list out of WhatsApp
is the case this exists for.
· **Add something twice, in different case.** `RC transfer` and
`rc TRANSFER` are one service; the second is refused with a message and
the box keeps what was typed, because there is nothing to retype.
· **Fill it to twelve.** The box and the button shut, and the placeholder
says why — a limit enforced at the point of entry rather than discovered
on save.

── How it submits ──────────────────────────────────────────────────────────
A hidden input carries `services.join(', ')` under `name`, which is exactly
what the old box submitted. `servicesOf()` in the server actions is unchanged
and is still the single parse. The visible box has **no `name`**: it is the
draft, not the value, and a draft must not be submittable.

A service typed but not added is still committed on submit — see the
`useEffect` in the component. Without that, the most natural mistake on the
screen (type, press Continue) silently loses the last entry.

### `<form`

A `<form>`, because two of the component's rules are about one: Enter

### `<form`

must not submit it, and an uncommitted draft must be committed when it

### `<form`

does. Neither is observable outside a form.

### `export const Empty: Story = {}`

A dealership that has not named a service yet — onboarding's opening state.

### `export const OneService: Story = { args: { value: ['In-house workshop'] } }`

One. The accent is on it, as it is on the first chip of a directory card.

### `export const ThreeServices: Story =`

The common shape. Three is what a directory card shows, so this is the row a
buyer is most likely to actually read.

### `export const WrappingToTwoRows: Story =`

Long labels, wrapping. `Tag` sets `white-space: nowrap`, so the wrap happens
between chips and never inside one — which is what keeps the row legible at
375px rather than producing a column of broken words.

### `export const AtTheLimit: Story =`

At the ceiling: the box and the button are shut and the placeholder says why.

### `export const WaitingForReview: Story =`

**R34** — an edit waiting for a moderator. The box is shut on the proposed
list and the chips carry no remove control, because the way out of this state
is withdrawing the whole change rather than editing it in place.

### `export const Invalid: Story =`

Inside its `Field`, refused by the server. The message is wired to the draft
box by `aria-describedby`, so the control a screen reader lands on is the one
that carries the explanation.
