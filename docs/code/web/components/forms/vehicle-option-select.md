# web / components/forms/vehicle-option-select

Parent: [web](../../../README.md)

## `apps/web/src/components/forms/vehicle-option-select/vehicle-option-select.tsx`

### `export function VehicleOptionSelect(...)`

The model and variant fields of the vehicle wizard. D1 rules out a model or
variant catalogue, so the list is whatever the marketplace already holds under
the chosen make (models) or make and model (variants): `GET
/v1/dealer/vehicles/suggestions?field=model&make=…`. It is the
suggest-existing guard rail D1 asked for, narrowed to the parent so a dealer
choosing Hyundai is offered `Creta` and `i20`, not every model in the database.

It fetches the whole scoped list once, when its parent is known, and filters it
locally. A make has tens of models and a model tens of variants, so one request
per parent is cheaper and faster than one per keystroke, and it is what lets
the list open on focus before anything is typed — the point of a dropdown on a
phone.

It is a combobox, not a `<select>` with an "Other" option, because "Other"
would be two controls and two taps for the commonest new-value case. Typing
anything not listed adds an "Add “…” as a new model" row; leaving the box keeps
what was typed. That is the "Other" path without a separate box.

What is posted is the hidden field, resolved through `existingVehicleSpelling`:
`I-20` typed under Hyundai posts `i20` when `i20` is listed. The API repeats
the same resolution on write, so a client that skips this still cannot add a
second spelling.

When its parent is empty it is disabled and says which field to fill first.
When the list cannot load it still takes typed text, so a failed lookup never
blocks a listing.

## `apps/web/src/components/forms/vehicle-option-select/utils.ts`

### `export async function fetchVehicleOptions(scope, signal)`

Throws on a non-2xx rather than returning `[]`, so the control can tell "nothing
is listed under this make yet" from "the list did not load" and say the right
one.
