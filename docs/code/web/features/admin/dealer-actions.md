# web / features/admin/dealer-actions

Parent: [web](../../../README.md)

The notes below belonged to the files named under each heading. Each heading is the
declaration the note sat above.

## `apps/web/src/features/admin/dealer-actions/approve-block.tsx`

### `<p className="w-full text-[12px] ink-muted">`

A disabled button with no explanation is indistinguishable from a
broken one. This is the missing condition, stated.

## `apps/web/src/features/admin/dealer-actions/dealer-actions.constants.ts`

### `export const MIN_REASON = 6`

Below this a reason is not a reason, and the dealer has nothing to act on.

## `apps/web/src/features/admin/dealer-actions/dealer-actions.tsx`

### `export function DealerAdminActions({ dealer }: { dealer: AdminDealerDetail })`

D4 — the dealer-moderation controls.

Which controls appear is the API's answer, not this component's: `actions`
comes back on `AdminDealerDetail` already resolved from the dealership's
status, so two admins looking at one record cannot reach different conclusions
about what is available.

**The approve control is rendered from the status, not from `canApprove`.**
`canApprove` is `PENDING_APPROVAL && allDocumentsVerified`, so an application
whose documents had not been reviewed showed no approve button at all — and,
since verifying a document was itself an API-only action, that was every
application. The button now always appears on a dealership waiting for a
decision, disabled with the unmet condition named. The permission is still the
API's to enforce.

**The two refusals are separated, and separated hard.** They were one word —
"reject" — doing two jobs. _Request changes_ hands the application back as
DRAFT with a note and deletes nothing. _Reject_ deletes the application, and
the applicant starts over as a first-time signup. An unreadable GST
certificate calls for the first; answering it with the second costs a real
business everything they entered.

── Reconstruction slice ────────────────────────────────────────────────────
The baseline renders a standalone credit grant here, gated on
`actions.canGrantCredits`, and an onboarding-credits field inside the approval
block. Both move credits, which means a `CreditTransaction` through
`moveCredits` (rule 4), and neither the model nor the facade exists until
**F050**. They return at **F054**; `canGrantCredits` is deliberately unread
here rather than removed.
────────────────────────────────────────────────────────────────────────────

### `const awaitingDecision = dealer.status === 'PENDING_APPROVAL'`

Waiting for a decision. The button appears on this; whether it is _usable_

### `const awaitingDecision = dealer.status === 'PENDING_APPROVAL'`

is `canApprove`, which additionally wants the KYC documents verified.

### `destination?: string`

Where to go afterwards, when refreshing is not an option. Rejection deletes
the dealership, so this page is a 404 the moment it succeeds and
`router.refresh()` would replace the confirmation with a not-found screen.

### `{!awaitingDecision &&`

With grants deferred to F054, a suspended-and-reinstated dealership at
rest has nothing to decide — and a card rendering a bare heading reads as
a rendering bug rather than as "nothing to do here".

## `apps/web/src/features/admin/dealer-actions/dealer-actions.types.ts`

### `export type RunAction =`

Runs one decision: clears the banners, awaits the action, then either shows
the failure or the success line. `destination` is for the decision that leaves
no page to refresh.

## `apps/web/src/features/admin/dealer-actions/reinstate-block.tsx`

### `export function ReinstateBlock({ dealer, pending, run, note, onNoteChange }: ReinstateBlockProps)`

SUSPENDED is not a terminal state and the console should not present it as one.

## `apps/web/src/features/admin/dealer-actions/reject-block.tsx`

### `export function RejectBlock(`

Reject — and it is a delete, so it is shaped like one.

Behind a disclosure rather than beside "Request changes", because the two
words read as neighbours and the outcomes are not: one asks for a clearer
photograph, the other removes a business's entire application from the
platform. What it destroys is spelt out before the control appears, and the
dealership's own name has to be typed — the standard confirmation for an
irreversible delete, warranted here because the thing being destroyed is
somebody else's.

### `DEALERS_LIST_PATH`

The dealership is gone; this page is a 404 now.

## `apps/web/src/features/admin/dealer-actions/request-changes-block.tsx`

### `export function RequestChangesBlock(`

The reversible refusal, immediately under approve — those two are the
decisions a moderator actually makes on this screen. Nothing is deleted: the
dealer gets their own form back, filled in, with this sentence at the top.

## `apps/web/src/features/admin/dealer-actions/suspend-block.tsx`

### `export function SuspendBlock({ dealer, pending, run, reason, onReasonChange }: SuspendBlockProps)`

Suspending pulls every one of this dealer's listings out of the catalogue at
once, so the count is stated before the button is pressed (rule 6) — and the
button stays disabled until there is a reason of substance behind it, because
the dealer reads that reason verbatim.
