# web / components/admin

Parent: [web](../../README.md)

The notes below belonged to the files named under each heading. Each heading is the
declaration the note sat above.

## `apps/web/src/components/admin/admin-nav.tsx`

### `export interface AdminNavItem`

DESIGN-SPEC §3.17 — the admin nav, on the cobalt-900 field.

The console's own `.dd-nav-item` colours are tuned for the white dealer
sidebar, so the admin variant is styled here rather than by overriding a
shared class in six places.

### `const NOT_YET_BUILT = new Set(['/admin/listings', '/admin/payments'])`

── Reconstruction slice (F048) ─────────────────────────────────────────────
`ADMIN_NAV` above is the baseline's list, verbatim, because it is the shell's
shape. Two of its five routes do not exist:

/admin/listings F069 The moderation queue
/admin/payments F053 Payments and credit grants

They were offered anyway from F049 until now, so two of the five items in a
cross-tenant operations console led to a 404. That is the mistake
`console-nav.tsx` was written to avoid on the dealer side, and the same
treatment applies here: **each feature above deletes its own line from this
set**, and its item appears. When the set is empty the constant goes with it
and `ADMIN_NAV` is rendered directly.

A `Set` of hrefs rather than a shortened list, for the same reason as the
dealer console: a reviewer comparing this file against the baseline should
find the list identical and the omission stated separately.

`/admin` itself comes off the set with this feature — the dashboard it points
at is what F048 lands.
────────────────────────────────────────────────────────────────────────────

### `export const LANDED_ADMIN_NAV: AdminNavItem[] = ADMIN_NAV.filter`

The items whose routes an operator can actually reach today.

### `export function AdminNav({ items = LANDED_ADMIN_NAV }: { items?: AdminNavItem[] })`

`items` defaults to the landed set, so the shell renders the honest nav
without having to know about the slice — and the sandbox can still be handed
`ADMIN_NAV` to draw the console as it will be. The same shape as
`ConsoleNav`, which takes its items outright.
