# web / features/admin/dealer-actions

Parent: [web](../../../README.md)

The notes below belonged to the files named under each heading. Each heading is the
declaration the note sat above.

## `apps/web/src/features/admin/dealer-actions/activation-override-block.tsx`

### `export function ActivationOverrideBlock({ dealer, pending, run }: ActivationOverrideBlockProps)`

The controlled exception to standard approval (**#299**). A Super admin may
activate a dealership whose identity and business documents have not completed
review, where policy permits it.

**It never verifies anything, and the block says so before anything else.** No
document is marked verified and Dealer Verified is untouched; the outstanding
categories stay outstanding, are listed right here, and stay on the dealer page
as a persistent warning (`ManualActivationNotice`). An override that quietly
looked like an approval would be indistinguishable from one, which is the one
thing it must not be.

The disclaimer is `MANUAL_ACTIVATION_DISCLAIMER` from the contract, rendered
verbatim — not paraphrased here — and the checkbox is what sends
`acknowledgedDisclaimer: MANUAL_ACTIVATION_DISCLAIMER_VERSION`. The API refuses
any other value, so if the text is ever changed the version changes with it and
an acknowledgement of the old wording stops being accepted.

The button is enabled by `ActivationOverrideInput` itself — the 40-character
justification and the acknowledged version — and by nothing else. There is no
GST review note any more, here or on approval (**L7**): GST registration is the
dealership's own responsibility, which it accepts when it signs up, and a
missing GSTIN is not something a reviewer adjudicates.

### `const blockedReason = dealer.actions.canOverrideActivation`

When the API offers no override it says why (`overrideBlockedReason`): a
rejected document, incomplete business details, the reviewer assisted the
dealership, or both categories are already verified and standard approval
applies. The block shows that sentence instead of the form; a form that could
only ever answer 409 is a trap.

The block appears only while the dealership awaits activation (`DealerAdminActions`
checks DRAFT or PENDING_APPROVAL). The API sets a blocked reason for every
ACTIVE dealership too, and printing "only an application awaiting activation…"
on every live dealer's page would be noise.

## `apps/web/src/features/admin/dealer-actions/revoke-override-block.tsx`

### `export function RevokeOverrideBlock({ dealer, pending, run }: RevokeOverrideBlockProps)`

Withdrawing a manual activation returns the dealership to PENDING_APPROVAL,
which takes its listings off the marketplace until it is approved the standard
way, and revokes any Dealer Verified status. That is a public consequence, so
the reason is required and at least 20 characters
(`RevokeActivationOverrideInput`), and the button is destructive.

## `apps/web/src/features/admin/dealer-actions/approve-block.tsx`

### `<p className="w-full text-[12px] ink-muted">`

A disabled button with no explanation is indistinguishable from a
broken one. This is the missing condition, stated.

## `apps/web/src/features/admin/dealer-actions/close-block.tsx`

### `export function CloseBlock`

ORIG-GAP-CLOSE. Offered where the API says (`actions.canClose` — DRAFT or
PENDING_APPROVAL), above Reject on purpose: closing keeps everything, and the
note under the button says so and names Reject as the fraud-and-abuse tool. A
`secondary` button rather than `destructive`, because nothing is destroyed.

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
