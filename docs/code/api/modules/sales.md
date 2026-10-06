# api / modules/sales

Parent: [api](README.md)

The notes below belonged to the files named under each heading. Each heading is the
declaration the note sat above.

## `apps/api/src/modules/sales/sales.service.ts`

### `export function createSalesService({ prisma, audit, cache, proof, otpDriver, maps, dealers }: SalesDeps)`

**R112** — a Sales representative onboards a dealership _with_ the dealer. The
module is mounted at `/v1/sales` behind `requireAdmin` and
`requirePermission('sales:workspace')`, which only `SALES_REP` holds; each route
additionally names its own `sales:dealer:*` permission.

The assisted dealership is the **same `dealers` row** a self-onboarded dealer
creates, with `onboardingSource = ASSISTED`, `assistedByMemberId` and
`assistedConsentAt`. It goes through the same completeness check, the same
`submitForVerification`, the same review queue and the same emails. Nothing
about the lifecycle forks; only the provenance is recorded.

What the representative is trusted with, and what they are not:

- the **phone** is proved on the dealer's handset by OTP, after the dealer's
  consent is recorded — the representative never types a number that is then
  believed;
- the **email** is captured, and stays unverified (`contactEmailVerifiedAt`
  null). Changing it clears any verification. It never becomes a sign-in
  identity;
- the representative **never decides** — no approve, reject or request-changes
  route exists here, and the admin service refuses those actions to the member
  who assisted (see `admin.md`).

### `async function requireAssisted(principal: AdminPrincipal, dealerId: string)`

Scope is `assistedByMemberId = principal.memberId`, and anything else is a
**404**, not a 403: another representative's dealership, and every
self-onboarded dealership, does not exist as far as this module is concerned.
A 403 would confirm the id.

### `async function requireEditable(principal: AdminPrincipal, dealerId: string): Promise<void>`

Editable means `DRAFT` and no `OWNER` member. Once submitted, the review owns
the row; once claimed, the dealer does. Either is `409 ASSISTED_DEALER_LOCKED`.

### `async verifyPhone(`

The OTP proof is the same `PhoneProofService.prove` the dealer's own
verification uses, under the `ASSISTED_DEALER_PHONE` purpose, so the replay
guard is shared and fails closed. The audit row carries the last four digits,
never the number, the code or the token.

### `async create(`

Serialised per phone by a transaction-scoped advisory lock, so two
representatives at the same dealer cannot race two dealerships onto one number;
the number is re-checked against every dealership's `contactPhone` inside the
lock.

### `async dashboard(principal: AdminPrincipal): Promise<SalesDashboard>`

A rejection purges the dealer row (the baseline behaviour, kept), so a rejected
assisted dealership is counted from the `dealer.rejected` audit snapshot, which
now records `assistedByMemberId`.

## `apps/api/src/modules/sales/assisted-phone-ticket.ts`

### `export function issueAssistedPhoneTicket(`

The proof that a phone was verified has to cross from the OTP step to the create
step without the client being trusted to carry the number. The ticket is an HMAC
over the phone, the member id and an expiry (30 minutes), so it cannot be
forged, cannot be moved to another representative, and cannot outlive the
visit.

### `export async function redeemAssistedPhoneTicket(`

Single use: the ticket's nonce is claimed in the `CachePort` before the create
proceeds, so a replayed ticket — or two tabs — produces one dealership.

## `apps/api/src/modules/sales/routes/phone-limit.ts`

### `export function salesPhoneLimit(limit: number, windowSeconds: number)`

The shared `byUser` key reads the signed-in _dealer_ principal and throws for an
admin one, so the Sales OTP routes key their limit on the admin member instead.
An OTP is an SMS, so this is a spend control as much as an abuse one.

### `async resendEmailVerification(`

**R113.** A new claim link, superseding the old one. The representative asks for
it and never sees it — the API answers with the dealership's detail, and the
link exists only in the dealer's inbox. Refused within a minute of the previous
request, and once the dealer has claimed the dealership.
