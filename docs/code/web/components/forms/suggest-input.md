# web / components/forms/suggest-input

Parent: [web](../../../README.md)

## `apps/web/src/components/forms/suggest-input/suggest-input.tsx`

### `export function SuggestInput(...)`

The suggest-existing control **F060** asked for and **R46** made universal: as a
dealer types a make or model, the values other vehicles already carry are
offered, so `Maruti Suzuki` is one facet rather than three spellings of it. It is
a suggestion, never a closed list — a genuinely new model must be enterable.

A native `<datalist>` rather than a custom combobox: the browser supplies the
keyboard contract, the screen-reader semantics and the mobile picker, and the
input stays an ordinary named field in a server-action form. The server is the
backstop either way — it adopts the stored spelling on write whatever was typed.

Lookups go through `app/api/dealer/vehicles/suggestions/route.ts`, which forwards
the dealer's session cookie server-side; the API itself is never called from the
browser. A failed lookup offers nothing and changes nothing else.
