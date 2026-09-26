# web / components/forms/plate-input

Parent: [web](../../../README.md)

The notes below belong to the files named under each heading. Each heading is the
declaration the note sits above.

## `apps/web/src/components/forms/plate-input/plate-input.tsx`

### `export function PlateInput(...)`

The registration-number field (**F056**, C019 in `component-map.md`). Under
**R46** it is the whole of the Registration step: there is no lookup behind it,
so what it accepts is what the vehicle is.

It is a component rather than an `<input pattern>` because the rule is not a
pattern. `parseRegistration` from `packages/contracts` reads the separators the
dealer typed — `KA 1 123` is RTO 1, number 123 — and a regular expression over
the value cannot. The API parses the same string with the same function, so the
browser and the server cannot disagree about whether a plate is valid.

**Uncontrolled, and rewritten on blur.** The console's forms are server actions
posting `FormData` (see `features/dealer/profile-actions.ts`), so the field
keeps its own value and submits it under `name`. On blur a readable plate is
rewritten to `KA 01 AB 1234`, which is the confirmation a dealer needs that the
characters were read the way they meant; the canonical `KA01AB1234` is the
server's business and never appears in the box.

**Two errors, one slot.** A local refusal (from the parser, on blur) wins over
the `error` prop (from the server, after a submit), and typing clears the local
one. An empty field says nothing on blur — "enter the registration number" is
the submit's job, not the job of a dealer tabbing past the field.

The styling (`.dd-plate-input` in `globals.css`) is DESIGN-SPEC §3.14's "one
plate field, styled as a number plate": mono, tracked, upper-case, the cobalt
left band. It is not the `Plate` motif — that is non-interactive and has
exactly four sanctioned uses (§4.5).
