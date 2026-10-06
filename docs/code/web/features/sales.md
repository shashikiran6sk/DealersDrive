# web / features/sales

Parent: [web](../README.md)

The notes below belonged to the files named under each heading. Each heading is the
declaration the note sat above.

## `apps/web/src/features/sales/assisted-dealer-start/assisted-dealer-start.tsx`

### `export function AssistedDealerStart({ widget }: { widget: PhoneOtpWidget | null })`

**R112** — the Sales representative is sitting with the dealer. The consent
sentence (`ASSISTED_CONSENT_TEXT`, from contracts, so the API records exactly
what was shown) is read out and ticked before any code is sent; the code goes
to the dealer's handset and the dealer reads it back. It reuses
`PhoneVerification` — the same widget and the same fake driver — with a
`verifyAction` that answers a single-use phone ticket instead of signing
anybody in. `checkAvailability` is null here, because the API's verify step is
where the duplicate-number refusal lives.

## `apps/web/src/features/sales/sales-actions.ts`

### `export async function verifyDealerPhoneAction(`

Consent travels as `true` or not at all: the contract is `z.literal(true)`, so
an unticked box is refused before the API is called, and refused again by the
API if this action is bypassed.

## `apps/web/src/features/sales/upload-paths.ts`

Documents and the yard photo go up the same presign → PUT → commit path a
dealer's do, through BFF routes under `/api/sales/dealers/[id]/…` that forward
the admin session cookie. `DocumentUploader` took a `basePath` string and
`YardPhotoUploader` a `paths` object of strings, rather than being copied, so
there is one uploader and two sets of URLs. Both are plain strings on purpose:
the Sales dealer page is a server component, and a function prop (the first
version had `commit: (type) => url`) cannot be serialised into a client
component — it fails at render, not at typecheck.

## `apps/web/src/lib/sales-session.ts`

### `export async function requireSalesMember(): Promise<SalesDashboard>`

The Sales layout's gate. It is a convenience for the redirect, not the
authorisation: every `/v1/sales` route checks `sales:workspace` and its own
permission on the API, and a console role that reaches `/sales` gets the API's
403 rendered as the error boundary.
