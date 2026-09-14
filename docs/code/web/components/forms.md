# web / components/forms

Parent: [web](../../README.md)

The notes below belonged to the files named under each heading. Each heading is the
declaration the note sat above.

## `apps/web/src/components/forms/field.tsx`

### `export function Field(`

DESIGN-SPEC §2.3 — label above, control, then an 11px `--err` message with
`margin-top:4px`.

The error id is derived from the control id so callers can wire
`aria-describedby` to it without inventing a second convention.

### `export function invalidProps`

The three attributes an errored control needs, or nothing at all.
