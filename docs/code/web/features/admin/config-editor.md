# web / features/admin/config-editor

Parent: [web](../../../README.md)

The notes below belonged to the files named under each heading. Each heading is the
declaration the note sat above.

## `apps/web/src/features/admin/config-editor/config-row.tsx`

### `export function ConfigRow({ entry }: { entry: ConfigEntry })`

D14 — one row, one value, one save.

The row renders a control when the API says something reads the key, and a
**placeholder** when nothing does. A placeholder is deliberately not an
editable field that quietly does nothing: an operator who sets "minimum
photos" to 8 and watches it save has been told the platform now requires eight
photos, and nothing on this screen would ever contradict them.

`readBy` comes from the API rather than a list in this file, because the
question it answers — _does any running code consult this key_ — is a fact
about the server.

## `apps/web/src/features/admin/config-editor/placeholder-row.tsx`

### `export function PlaceholderRow({ entry }: { entry: ConfigEntry })`

A key nothing reads yet. The value is shown, because "what will this be when
the feature lands" is a real question, and the control is not, because
changing it would change nothing and say otherwise.

## `apps/web/src/features/admin/config-editor/utils.ts`

### `export function toInput(entry: ConfigEntry): string`

The stored value as the control holds it — a list is one entry per line.

### `export function displayValue(entry: ConfigEntry): string`

The stored value as one line — a list becomes "3 entries" rather than a wall.
