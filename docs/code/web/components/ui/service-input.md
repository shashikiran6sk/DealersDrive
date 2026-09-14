# web / components/ui/service-input

Parent: [web](../../../README.md)

The notes below belonged to the files named under each heading. Each heading is the
declaration the note sat above.

## `apps/web/src/components/ui/service-input/service-input.tsx`

### `export function ServiceInput(`

DESIGN-SPEC §2.5 — the services list, entered one service at a time (**R37**).

`specialities` is an array in the contract and was a comma-separated text box,
which asked the dealer to hold a serialisation format in their head and hid
the one fact they most need to see: how many services they have named, and
which. Buyers already see this list as chips on the directory card and the
portfolio, so the editor is now the same picture.

A hidden input carries `services.join(', ')` under `name` — exactly what the
comma-separated box submitted — so the wire format, the contract and the API
are untouched. The visible box has **no `name`**: it is the draft, not the
value, and a draft must not be submittable.

### `const latest = useRef({ services, draft })`

The submit listener below is a native DOM handler and sees whatever was
current when it was attached, not when it fires. A ref is the value that
moves; the state is the value that renders.

### `const next = [...latest.current.services]`

Computed from the ref rather than inside a `setServices` updater: an
updater does not run until React renders, so the counters would still be
zero when the message is chosen and when this function returns.

### `return !(duplicates === entries.length || overLength === entries.length)`

Every entry was refused, so the box keeps what the dealer typed: there

### `return !(duplicates === entries.length || overLength === entries.length)`

is nothing to retype and the message says what to change.

### `useEffect(() =>`

A service typed but not added is still a service the dealer meant to add —
without this, type-then-Continue silently discards the last thing they
wrote. Writing the hidden input's `value` directly is what makes it work: a
`setState` here would not have flushed before the form serialises.

### `required={required && services.length === 0}`

`required` only while the list is empty, and on the _draft_ box
rather than the hidden input: the browser cannot focus or message a
hidden control, so the native refusal would have been a form that
silently would not submit.

### `if (event.target.value.includes(','))`

A typed or pasted comma means the entry is finished.

### `event.preventDefault()`

Otherwise Enter submits the whole onboarding step, which is the

### `event.preventDefault()`

opposite of what pressing it in this box means.

### `<div`

A `group` rather than a `list`, deliberately: every onboarding step
already contains one `<ol>`, the stepper, so a second list role makes
`getByRole('list')` ambiguous. `aria-live` because adding a chip changes
this row without moving focus.

### `<Tag key={service} variant={index === 0 ? 'accent' : 'neutral'}>`

The first chip takes the accent, as the directory card renders it (**R29**).

## `apps/web/src/components/ui/service-input/service-input.types.ts`

### `id: string`

Labels the visible draft box, so the `<Field>`'s label points at it.

### `name?: string`

The form key. `undefined` submits nothing — the R34 waiting-for-review lock.

### `required?: boolean`

Blocks submit with the browser's own message while the list is empty.

## `apps/web/src/components/ui/service-input/utils.ts`

### `export function splitServiceEntries(raw: string): string[]`

Splits what was typed or pasted into candidate services. Splitting on paste is
not a convenience — it is the reason a dealer who copies their service list
out of WhatsApp does not end up with one chip sixty characters long.

### `export function containsService(services: readonly string[], entry: string): boolean`

"RC transfer" and "RC Transfer" are one service, and a buyer should not see both.
