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

Submission is not on this screen yet. It lands with the listing lifecycle
(**F064**/**F065**), which is what gives "submit" somewhere to go.

## `apps/web/src/features/vehicle/vehicle-wizard/wizard-footer.tsx`

### `export function WizardFooter(...)`

`useFormStatus` disables all three buttons while a save is in flight, so a double
click cannot send two PATCHes, and the primary shows the spinner. DESIGN-SPEC
§3.14's footer: Back, then Save draft pushed right, then the primary; stacked
full-width on a phone.
