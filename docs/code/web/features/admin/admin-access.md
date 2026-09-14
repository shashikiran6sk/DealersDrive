# web / features/admin/admin-access

Parent: [web](../../../README.md)

The notes below belonged to the files named under each heading. Each heading is the
declaration the note sat above.

## `apps/web/src/features/admin/admin-access/admin-access.tsx`

### `export function AdminAccessPanel({ entries, currentUserId }: AdminAccessPanelProps)`

Who may open this console (**R42**).

Until now the answer was `ADMIN_ALLOWLIST` alone: a comma-separated list in
the environment, which meant adding a colleague was a deploy. That bought a
real property — no bug in an admin screen could promote anybody, because the
row was not what was consulted — and cost a deploy for a thing that happens
when somebody joins. A **grant** is the second answer: a row made deliberately
by a SUPER_ADMIN, recorded with who made it and audited.

Two things this screen refuses. **Your own seat** — withdrawing it would lock
the person doing it out of the screen they are standing on. **An allow-listed
address** — the environment wins, and the row says so rather than offering a
control that cannot keep its promise.

### `if (entry.userId === null) return`

`canRevoke` is false for every row without a userId — an allow-listed

### `if (entry.userId === null) return`

address nobody has signed in with has no account to withdraw — so this

### `if (entry.userId === null) return`

narrowing never refuses a control the operator can actually see.
