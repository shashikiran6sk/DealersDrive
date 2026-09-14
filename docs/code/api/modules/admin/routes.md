# api / modules/admin/routes

Parent: [api](../../../README.md)

The notes below belonged to the files named under each heading. Each heading is the
declaration the note sat above.

## `apps/api/src/modules/admin/routes/delete-access.ts`

### `export const deleteAccess: AdminRoute = (router, service) =>`

`DELETE` rather than a status field, because withdrawing a grant is not a state
the grant can be in — it is the grant not existing.

## `apps/api/src/modules/admin/routes/get-access.ts`

### `export const getAccess: AdminRoute = (router, service) =>`

Who may open this console (**R42**). The allow-list is the other half of the
answer and is deliberately not writable from here: it lives in the deployment,
and the list this returns says which rows came from where.

## `apps/api/src/modules/admin/routes/get-profile-changes.ts`

### `export const getProfileChanges: AdminRoute = (router, service) =>`

D3b — the profile edits waiting for a decision (**R34**).

A queue of its own rather than a filter on the dealer list, because it is work
rather than a property of a dealership: oldest first, and every row carries
what is live beside what is proposed so a moderator can decide without opening
the dealership. The dealer list carries `?pendingEdits=true` as well, for the
moderator who arrives from the other direction.

## `apps/api/src/modules/admin/routes/handle.ts`

### `export function handle<T>(work: (req: Request) => Promise<T>, status = 200): RouteHandler`

`Cache-Control: no-store` on everything this router answers: a moderator
acting on a stale queue approves a listing somebody else already rejected.

## `apps/api/src/modules/admin/routes/patch-dealer.ts`

### `export const patchDealer: AdminRoute = (router, service) =>`

The dealer's own answers, amended by the console.

Deliberately the **same schema** `PATCH /v1/dealer` validates with. An admin
editing a dealership is editing a dealership: the fields, their bounds and the
normalisation behind them are properties of the data, not of who is holding
the pen. A separate `AdminUpdateDealerInput` would be a second place for the
GSTIN pattern to live, and the two would drift.

## `apps/api/src/modules/admin/routes/post-dealer-reject.ts`

### `export const postDealerReject: AdminRoute = (router, service) =>`

The two refusals, and they are different verbs on purpose. `reject` destroys
the application — storage, documents, membership and the dealership row.
`request-changes` keeps every byte of it and hands it back to the dealer to
correct. Both take the same body, because the dealer reads the reason verbatim
either way; only one of them is reversible.

## `apps/api/src/modules/admin/routes/post-profile-change-approve.ts`

### `export const postProfileChangeApprove: AdminRoute = (router, service) =>`

Keyed by the change rather than by the dealership, the way the document
decisions are: the thing being decided on has an id, and addressing it by
`/dealers/:id/profile-change` would make "which edit" a question the server
answers by guessing at the newest one — exactly wrong when a dealer saves again
while a moderator has the page open.

## `apps/api/src/modules/admin/routes/post-profile-change-reject.ts`

### `export const postProfileChangeReject: AdminRoute = (router, service) =>`

`ReasonInput`, shared with the dealer and document rejections, and not a
coincidence: all three are refusals a person reads verbatim, and all three are
worse than useless without a sentence.

## `apps/api/src/modules/admin/routes/put-config-key.ts`

### `export const putConfigKey: AdminRoute = (router, service) =>`

D14 — the settings screen (**F072**).

One key per write rather than a blob PATCH over the table. These values govern
money and moderation — the GST percentage, the listing duration, the reveal
caps — so "what did this admin change" should be a row in the audit log, not a
diff somebody has to compute.
