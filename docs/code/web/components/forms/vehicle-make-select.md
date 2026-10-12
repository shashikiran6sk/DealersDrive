# web / components/forms/vehicle-make-select

Parent: [web](../../../README.md)

## `apps/web/src/components/forms/vehicle-make-select/vehicle-make-select.tsx`

### `export function VehicleMakeSelect(...)`

The make field of the vehicle wizard. Unlike a model, a make is a short list of
manufacturers known in advance, so it is a closed choice over `VEHICLE_MAKES`
from `packages/contracts`. Without a list, `Maruti`, `Maruti Suzuki` and
`MARUTI SUZUKI INDIA LTD` became three brand facets, which is the D1 risk; with
one, the stored value is the brand's own spelling from the first save.

It is a combobox, not a native `<select>`, because forty-odd options need
searching on a phone. The visible input is only the search box; the value posted
is a hidden `make` field holding the chosen canonical name. Leaving the box
with text that resolves exactly — a canonical name in any case, or a reviewed
alias like `Tata Motors` — selects that brand. Anything else falls back to the
last choice, so a half-typed search is never posted.

A vehicle saved before the list existed keeps its stored make: if that value
names no brand, it is offered at the top as "(as saved)" and stays selected.
Re-saving the step therefore never forces a dealer to change a make they did
not touch. The API accepts that one value for that one vehicle and nothing
else (`vehicles.service.ts`, `checkMake`).

## `apps/web/src/components/forms/vehicle-make-select/utils.ts`

### `export function matchMakes(search, saved)`

Substring match on the canonical names with case, spaces and punctuation
ignored on both sides, plus the brand an exact alias resolves to. So
`marutisuz`, `mercedes benz` and `M&M` all find their brand. There is no fuzzy
matching: a list this short is scanned by eye faster than a misspelling is
guessed at.
