# web / components/forms/field

Parent: [web](../../../README.md)

The notes below belonged to the files named under each heading. Each heading is the
declaration the note sat above.

## `apps/web/src/components/forms/field/field.tsx`

### `export function Field({ id, label, hint, error, children, className }: FieldProps)`

DESIGN-SPEC §2.3 — label above, control, then an 11px `--err` message with
`margin-top:4px`.

## `apps/web/src/components/forms/field/utils.ts`

### `export function errorId(id: string): string`

The error element's id, derived from the control's so callers need no second convention.

### `export function invalidProps`

The three attributes an errored control needs, or nothing at all.
