# web / features/vehicle

Parent: [web](../README.md)

The notes below belong to the files named under each heading. Each heading is the
declaration the note sits above.

The dealer's add / edit vehicle wizard (**F060**, **F061**, **F063**, as revised
by **R45** and **R46**): Registration → Vehicle basics → Vehicle details →
Pricing → Review. It has **no Photos step** — Dealers-Drive photographs every
car itself and an admin uploads the processed images — and **no lookup**: every
field is typed by the dealer.

## `apps/web/src/features/vehicle/actions.ts`

### `export async function createVehicleAction(...)`

The Registration step of a new vehicle. The plate is parsed here with the
contracts `CreateVehicleInput` before the API is called, so a plate the parser
cannot read is refused without a round trip — and with the same sentence the API
would have used, because it is the same function. Only the canonical plate is
sent; nothing else in the form data reaches the body, whatever a tampered form
posts.

### `export async function saveVehicleStepAction(...)`

One form, three intents, chosen by the button pressed (`intent`):

- **Continue** saves, then moves on _only if the API's own `issues` list has
  nothing left on this step_. The console never decides completeness itself —
  it reads `vehicleIssues()` as evaluated by the API, so the wizard can never be
  more permissive than the server (F063's gate).
- **Save draft** saves and stays, with `?saved=1` for the confirmation banner.
- **Back** saves and goes back. It does not gate: going back to fix an earlier
  step must not be blocked by a later one.

Only the current step's fields are sent (`STEP_FIELDS`), so a step never blanks
another. An emptied box is sent as `null`, which clears it. The price is typed in
rupees and sent as integer paise (rule 3). Letters in a number box are refused
here with "Enter digits only." rather than being handed to Zod as `NaN`, whose
message is written for developers.

On a refusal the typed values are echoed back in `values`, and every input reads
`values[field] ?? stored` as its default — React resets an uncontrolled form
after a server action, so without the echo a validation error would also erase
what the dealer typed.

## `apps/web/src/features/vehicle/vehicle-wizard/vehicle-wizard.tsx`

### `export function VehicleWizard(...)`

**The step lives in the URL** (`/dealer/vehicles/:id/edit?step=details`), and the
vehicle lives in the database. There is no client store: a refresh, a second
tab or a shared link all land on the same step with the same saved data, and a
half-filled wizard is simply a draft in the inventory.

A vehicle that does not exist yet can only be on the Registration step, which is
why the new-vehicle page renders the wizard with `vehicle={null}` and the form
posts to `createVehicleAction`.

## `apps/web/src/features/vehicle/vehicle-wizard/review-step.tsx`

### `export function ReviewStep({ vehicle }: { vehicle: DealerVehicle })`

Every section links back to its own step, and every missing field links to the
step that holds it (`stepOfField`). The page says in words that the dealer does
not upload photographs — the step a dealer used to reach at this point is gone,
and silence about it reads like a bug.

The footer is `submit-row.tsx`: _Submit for review_ (or _Resubmit for review_
after a request for changes) is disabled, with a line saying why, until the API
reports the vehicle complete (`listing.canSubmit`). It is a separate form from
the step forms, posting to `submitVehicleAction`, which sends no body — what is
submitted is what is stored.

## `apps/web/src/features/vehicle/vehicle-wizard/wizard-footer.tsx`

### `export function WizardFooter(...)`

`useFormStatus` disables all three buttons while a save is in flight, so a double
click cannot send two PATCHes, and the primary shows the spinner. DESIGN-SPEC
§3.14's footer: Back, then Save draft pushed right, then the primary; stacked
full-width on a phone.

## `apps/web/src/features/vehicle/vehicle-wizard/submitted-panel.tsx`

### `export function SubmittedPanel({ doneHref }: { doneHref: string })`

DESIGN-SPEC §3.14's _Submitted_ screen: a blueprint card with the `Pending
review` tag and what happens next — the team checks the details and arranges a
photo shoot. It is reached through `?submitted=1` on the same edit URL and only
renders while the listing really is PENDING_REVIEW, so a stale or hand-typed
link shows the vehicle as it is instead.

## `apps/web/src/features/vehicle/vehicle-wizard/submit-row.tsx`

### `mayPublish = true,`

**R95.** STAFF prepare drafts; a manager or the owner sends them for review. For
STAFF the review step offers no Submit and says who will — the API would refuse
it, and `canSubmit` comes back false for them anyway, but without this the row
would explain the missing button as "fill in the missing details", which is not
the reason.

## `apps/web/src/features/vehicle/vehicle-wizard/wizard-scope.ts`

### `export const WizardScopeContext = createContext<WizardScope>(DEALER_SCOPE)`

**R114.** The same wizard serves the dealer and the Sales workspace. The scope
decides two things only: which API the server actions call (a hidden
`salesDealerId` field, validated as a UUID — anything else falls back to the
dealer's own routes, and the API authorizes either way), and where links and
redirects point. In the Sales scope the dealer's lifecycle panel (reserve, sell,
withdraw) is not offered, and a submission that waits for approval says so.
