# web / app/(admin)/admin/config

Parent: [web](../../../../README.md)

The notes below belonged to the files named under each heading. Each heading is the
declaration the note sat above.

## `apps/web/src/app/(admin)/admin/config/page.tsx`

### `export default async function AdminConfigPage()`

D14 — the settings screen (**F072**), with admin access on it (**R42**).

Two sections, and the split is by what a change does rather than by what it
looks like:

**In use** — a key some running code reads. Changing one of these changes
the platform's behaviour on the next request, with no deploy.

**Not in use yet** — a key that exists in `CONFIG_DEFAULTS` and is read by
nothing, because the feature that will read it has not been reconstructed.
These are shown rather than hidden, because "what will the listing duration
be" is a fair question, and they are read-only, because an editable control
that changes no behaviour is a lie told politely.

The API decides which is which — `readBy` is a fact about the server, not a
list this page maintains.
