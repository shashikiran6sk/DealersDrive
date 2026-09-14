# api / modules/dealers/routes

Parent: [api](../../../README.md)

The notes below belonged to the files named under each heading. Each heading is the
declaration the note sat above.

## `apps/api/src/modules/dealers/routes/delete-profile-change.ts`

### `export const deleteProfileChange: DealersRoute = (router, service) =>`

C2c — the dealer taking their own proposal back (**R34**).

`DELETE` on the thing being removed, and no body: there is at most one
request waiting per dealership, so naming it in the URL would be asking the
client for an id it can only have got from the same response that told it
the button should exist.

A button rather than an inference. The first shape of this read "the dealer
retyped the live value" as a cancellation, which made the way out something
to discover rather than press — and was wrong on its own terms besides,
since an edit that happens to restore the live text is still an edit.

`dealer:update` is the permission, because withdrawing is the other half of
submitting. It answers **404** when nothing is waiting: the button only
renders when there is one, so reaching here empty-handed is a double-click
or a stale page, and both want the screen re-read.

## `apps/api/src/modules/dealers/routes/get-dashboard.ts`

### `export const getDashboard: DealersRoute = (router, service) =>`

C18 — the console landing page (**F048**).

No permission: `requireDealer` has already run, and a salesperson who
cannot see their own dashboard has a broken console. The tenant scope still
comes from the principal, so nothing here is unscoped.

`no-store`, and the credit balance is why. Every other read on this router
is a profile a dealer is looking at; this one carries a number they are
about to spend, and a stale balance is worse than a slow one.

## `apps/api/src/modules/dealers/routes/get-yard-photo.ts`

### `export const getYardPhoto: DealersRoute = (router, service) =>`

The yard photograph — three writes and a read, mounted beside the KYC
documents because a dealer meets them on the same onboarding step, and
kept separate from them because it is the opposite kind of image: destined
for the public portfolio rather than for a moderator's eyes only.

## `apps/api/src/modules/dealers/routes/patch-onboarding.ts`

### `export const patchOnboarding: DealersRoute = (router, service) =>`

C2b — the same dealership, while it is still a DRAFT (**R27**).

The onboarding wizard's Back button leads to steps 1 and 2, and those steps
ask for exactly the fields the profile screen may no longer touch. That is
not a contradiction: a DRAFT dealership is one that is still _answering_
these questions, or one a moderator has sent back to fix an answer. Nothing
has been verified about it yet, so there is nothing an edit can invalidate.

The whole of the difference between this route and the one above is the
status guard in `amendDraft`, and it is a guard rather than a permission:
`dealer:update` is the same permission both routes need, and the question
here is not who is holding the pen but whether the record has been checked
yet.

## `apps/api/src/modules/dealers/routes/patch-profile.ts`

### `export const patchProfile: DealersRoute = (router, service) =>`

C2 — the dealership editing itself, after onboarding is over (**R27**),
with two of the three fields held for review (**R34**).

`DealerSelfUpdateInput`, not `UpdateDealerInput`. The difference is the
whole of a dealer's authority over their own record: the year they started,
the line they describe themselves in, and what their yard does. The
registered name, the address, the town, the pin, the mobile and the email
are absent from that schema, so sending one is a 400 that names the field
rather than a silent write — see the schema for why each of them is
evidence rather than a preference.

**This is a 200 either way, and that is deliberate.** On an ACTIVE
dealership the tagline and the service list do not reach the dealership row
— they become a `DealerProfileChange` a moderator decides on — but the save
_succeeded_: the dealer's edit was accepted and recorded. A 202 would be
more literally accurate about the queue and would tell a browser the wrong
thing about the response body, which is the dealership as it stands now,
with `profileChange` on it saying what is waiting. The screen reads that
field rather than the status code.

`selfUpdate` rather than `update`, and the second argument is why: the
queue records _who_ typed the words, not only which dealership they belong
to. `dealerId` still comes from the session and never from the body
(rule 1); so does the user id.

The admin console keeps the full shape at
`PATCH /v1/admin/dealers/:id`, and a dealership still answering the
onboarding questions keeps it at `PATCH /v1/dealer/onboarding` below.
