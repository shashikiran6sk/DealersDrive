# web / features/sales

Parent: [web](../README.md)

The notes below belonged to the files named under each heading. Each heading is the
declaration the note sat above.

## `apps/web/src/features/sales/assisted-dealer-start/assisted-dealer-start.tsx`

### `export function AssistedDealerStart({ widget, initialVerified }: AssistedDealerStartProps)`

**R112** — the Sales representative is sitting with the dealer. The consent
sentence (`ASSISTED_CONSENT_TEXT`, from contracts, so the API records exactly
what was shown) is read out and ticked before any code is sent; the code goes
to the dealer's handset and the dealer reads it back. It reuses
`PhoneVerification` — the same widget and the same fake driver — with a
`verifyAction` that answers a single-use phone ticket instead of signing
anybody in. `checkAvailability` is null here, because the API's verify step is
where the duplicate-number refusal lives.

**#299** made it verify-first. Step 1 proves the mobile _and_ the email — the
email by a 6-digit code the dealer reads out of their inbox — and the Continue
button exists only once both tickets are in hand, because the dealership is
created from them: the account the dealer later signs in with is made from the
proved phone and email in the same transaction, so there is no claim link any
more. Step 2's form therefore has no email field, and a successful create goes
straight to Step 3, the documents page.

"Verify again" drops both tickets (they last 30 minutes) and remounts the email
block through a `key`, so it starts again from the typed address rather than
from a stale verified state; what was typed into the form survives.
`initialVerified` is the sandbox's way into the both-verified state.

## `apps/web/src/features/sales/email-code-verification/email-code-verification.tsx`

### `export function EmailCodeVerification({ onVerified, initialEmail, disabled, initialStage }: EmailCodeVerificationProps)`

The email half of #299's Step 1, and of "Verify now". The API answers a send
with a signed `challenge`, never the code, so a representative holding the
screen cannot prove an address on their own; the code is only in the email.
The address is checked with the contract's `SalesEmailCodeInput` before the
action is called, so a typo is refused in the same words the API would use.

"Send a new code" waits out the API's own `resendAfterSeconds` rather than a
local constant, so the countdown cannot disagree with the 429 the API would
otherwise answer. Once verified the address is read-only: the ticket handed to
`onVerified` belongs to that exact address. `initialStage` exists, like
`PhoneVerification`'s, so the sandbox can open the code, wrong-code and
verified states without an inbox.

## `apps/web/src/features/sales/verify-owner-panel/verify-owner-panel.tsx`

### `export function VerifyOwnerPanel({ dealerId, phone, phoneDisplay, widget }: VerifyOwnerPanelProps)`

"Verify now" for an assisted dealership created before #299, which has no
owner account and so cannot be approved (the API requires an owner with a
verified phone and email). The number is the dealership's own and is not
editable: the API refuses any other with `VERIFY_PHONE_MISMATCH`, so offering a
field would only offer a way to fail. The dealer's consent is asked again,
because the code is a new authorisation. Rendered only when the API says
`canVerify`; `phone` is derived from `phoneDisplay` with
`normaliseIndianMobile` because `SalesDealerDetail` carries only the display
form.

## `apps/web/src/features/sales/assisted-consent/assisted-consent.tsx`

### `export function AssistedConsent({ id, checked, disabled, onChange }: AssistedConsentProps)`

The consent checkbox both Step 1 and "Verify now" show before a code goes to
the dealer's phone. One component so the sentence and its layout cannot drift
apart between the two.

## `apps/web/src/features/sales/sales-actions.ts`

### `export async function verifyDealerPhoneAction(`

Consent travels as `true` or not at all: the contract is `z.literal(true)`, so
an unticked box is refused before the API is called, and refused again by the
API if this action is bypassed.

### `export async function sendDealerEmailCodeAction(email: string): Promise<EmailCodeResult>`

A 503 (`EMAIL_CODE_SEND_FAILED`) is answered in this action's own words rather
than through `ApiError.userMessage`, which deliberately hides every 5xx detail
behind the generic server-error sentence — here the useful thing to say is
that the code did not go, and to check the address.

## `apps/web/src/features/sales/rep-scope-notice/rep-scope-notice.tsx`

### `export function RepScopeNotice({ businessComplete }: { businessComplete: boolean })`

A representative's mandatory work ends once the business details (Step 2)
are saved (#299). Documents and the submit are optional for them: the dealer
can upload the documents and submit later from their own account. The page
used to present documents, a yard photograph and a submit button as sections
to get through, which read as a checklist the representative had to finish
before leaving the dealer — so the page now says where their part ends.

The tone follows the API's `business` completeness step, not a local guess:
green once it is complete, amber naming Step 2 while anything there is still
missing. Shown only while the representative can still edit.

## `apps/web/src/app/(sales)/sales/dealers/[id]/documents/page.tsx`

Step 3 of 3 since #299: documents and the optional submit moved off the dealer
page onto their own page, so the dealer page is the business details (Step 2)
and "Save and continue" leads here through `AssistedDealerForm`'s `doneHref`.
The redirect is a string prop rather than an `onDone` callback because the
dealer page is a server component and cannot hand a function to a client one.

The representative types no GSTIN or PAN on the details form any more
(**L7**). The GSTIN is entered here, on the business card beside the GST
certificate, and the page passes the one on file to `DocumentUploader` as
`gstin` so replacing the certificate keeps it in the box.

## `apps/web/src/features/sales/upload-paths.ts`

Documents go up the same presign → PUT → commit path a dealer's do, through
BFF routes under `/api/sales/dealers/[id]/documents/…` that forward the admin
session cookie, addressed by category like the dealer's. `DocumentUploader`
takes a `basePath` string rather than being copied, so there is one uploader
and two sets of URLs. It is a plain string on purpose: the Sales dealer page
is a server component, and a function prop (the first version had
`commit: (type) => url`) cannot be serialised into a client component — it
fails at render, not at typecheck.

There is no yard photograph here any more: #299 removed it from assisted
onboarding along with the routes behind it.

## `apps/web/src/lib/sales-session.ts`

### `export async function requireSalesMember(): Promise<SalesDashboard>`

The Sales layout's gate. It is a convenience for the redirect, not the
authorisation: every `/v1/sales` route checks `sales:workspace` and its own
permission on the API, and a console role that reaches `/sales` gets the API's
403 rendered as the error boundary.
