# web / features/dealer/documents-overview

Parent: [web](../../README.md)

The owner's Documents page at `/dealer/documents` (**L8**), and the dashboard
banner that points to it. A dealership a Super admin activated before its
documents were verified is ACTIVE and can list cars, but still owes one
Personal Identity Proof and one Business Identity Proof; the API's "Your
dealership is live — upload your documents" email links here. A dealership
approved the standard way sees its verified documents.

## `apps/web/src/app/(dealer)/dealer/documents/page.tsx`

### `export default async function DealerDocumentsPage()`

The page asks the session for `document:upload` before it asks the API for
anything, and anyone else is sent to the dashboard — the shape of the Photos
and Team pages. `GET /v1/dealer/documents` and every document write are OWNER
only, so a manager shown this page would be shown a 403. It reads the
documents and the dealership (`/v1/dealer`, for its status and the GSTIN on
file), the same two reads the onboarding documents step is given.

## `apps/web/src/app/(dealer)/dealer/page.tsx`

### `async function outstandingDocumentsOrNone(): Promise<DocumentRequirementGap[]>`

The dashboard payload says nothing about documents, so the banner is decided
here: only for an ACTIVE dealership, and only for a session that may read the
documents at all — anyone else is asked nothing. A failure to read them costs
the banner, not the dashboard: it is a reminder, and the Documents page is one
click away in the nav.

## `apps/web/src/components/dealer/console-nav/utils.ts`

### `export function consoleNavFor(permissions: readonly string[]): NavItem[]`

Documents is offered for `document:upload` only, between Photos and Team, with
no `short`, so on a phone the owner reaches it from the menu drawer.

## `apps/web/src/features/dealer/documents-overview/utils.ts`

### `export function outstandingDocuments(documents, gstin)`

The rule is `documentRequirement(documents, gstin, isVerifiedDocument)` — the
one approval and Dealer Verified judge by — so the page cannot call a set of
documents complete that the review would not. A document in review is
outstanding: it is not verified yet.

**There is no `activationMethod` here.** It is on the admin dealer payload
(`DealerActivationState`) and on no dealer-facing one — not `DealerProfile`,
`AuthSession` or `DashboardResponse` — so the page cannot say "you were
manually activated". It says what is true either way: an ACTIVE dealership
with documents outstanding is live without them, and an activation granted
ahead of verification can be withdrawn. The only other route to that state, a
document revoked after standard approval, reads correctly under the same
sentence.

### `export function isLockedDocument(document: DealerDocumentDto | null): boolean`

Outside DRAFT the API refuses to change an UPLOADED or VERIFIED document
(`DOCUMENT_LOCKED`); an empty, REJECTED or UPLOADING slot can be filled. The
uploader is told so rather than offering Replace and Delete that would only
ever end in a 409.

## `apps/web/src/features/dealer/documents-overview/documents-status.tsx`

### `export function DocumentsStatus({ gaps, active }: DocumentsStatusProps)`

Nothing outstanding is a calm line, not a green banner: there is nothing to
do. Anything outstanding is named in `DOCUMENT_GAP_LABELS`' words, and the
warning about withdrawal is reserved for an ACTIVE dealership — a suspended
one has nothing live to lose by it.

## `apps/web/src/features/dealer/documents-overview/documents-overview.tsx`

### `export function DocumentsOverview({ documents, gstin, dealerStatus }: DocumentsOverviewProps)`

One `DocumentUploader` per `SELECTABLE_DOC_CATEGORIES`, with the GSTIN on file,
exactly as the onboarding documents step renders them; the uploads go through
the same `/api/dealer/documents/*` BFF routes and `router.refresh()` re-reads
the page. Dealer Verified is mentioned once, as the separate review it is, so
a verified document is never read as the badge.

## `apps/web/src/features/dealer/documents-overview/documents-reminder.tsx`

### `export function DocumentsReminder({ gaps }: DocumentsReminderProps)`

The dashboard's banner, in the same `Banner` + secondary-link shape as the
API's own alerts beside it. It renders nothing when nothing is outstanding, so
the page can render it unconditionally.
