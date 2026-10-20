# api / modules/sales

Parent: [api](README.md)

The notes below belonged to the files named under each heading. Each heading is the
declaration the note sat above.

## `apps/api/src/modules/sales/sales.service.ts`

### `export function createSalesService({ prisma, audit, cache, mailer, proof, otpDriver, maps, dealers }: SalesDeps)`

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
- the **email** is proved the same way — a 6-digit code emailed to the
  dealer, read out from their inbox — before anything is saved;
- the account those two prove becomes the dealership's **OWNER** at creation
  (`provisionOwnerAccount`, `auth/owner-account.ts`): an existing account is
  reused, never duplicated, so the dealer signs in with Google or a phone code
  and lands in the dealership. There is no claim link;
- the representative **never decides** — no approve, reject or request-changes
  route exists here, and the admin service refuses those actions to the member
  who assisted (see `admin.md`).

### `async function requireAssisted(principal: AdminPrincipal, dealerId: string)`

Scope is `assistedByMemberId = principal.memberId`, and anything else is a
**404**, not a 403: another representative's dealership, and every
self-onboarded dealership, does not exist as far as this module is concerned.
A 403 would confirm the id.

### `async function requireEditable(principal: AdminPrincipal, dealerId: string): Promise<void>`

Editable means `DRAFT`. Once submitted, the review owns the row:
`409 ASSISTED_DEALER_LOCKED`. The owner exists from creation, so ownership no
longer locks the draft — the representative and the dealer can both finish it.
The verified phone and email are not editable at all; a different person means
a different dealership.

### `async verifyPhone(`

The OTP proof is the same `PhoneProofService.prove` the dealer's own
verification uses, under the `ASSISTED_DEALER_PHONE` purpose, so the replay
guard is shared and fails closed. The audit row carries the last four digits,
never the number, the code or the token.

### `async create(`

Serialised per phone by a transaction-scoped advisory lock, so two
representatives at the same dealer cannot race two dealerships onto one number;
the number and the email are re-checked inside the lock, and the owner account
is provisioned in the same transaction — a refusal (a staff account, an account
that already runs a dealership, a phone and an email that belong to two
different accounts) leaves nothing behind.

The tickets are opened and checked unspent before the business checks, and
redeemed only after them: a name clash or an unreadable Maps link does not
cost the dealer another OTP and another email code.

### `async sendEmailCode(`

The code travels only in the email. The API answers with a signed `challenge`
that carries a keyed MAC of the code (`assisted-email-code.ts`), so nothing is
stored and the client never holds the code. A send is refused for 60 seconds
after the previous one and after five in an hour, per address — the address is
the dealer's inbox, so it is the dealer who is protected from a flood, not the
representative's quota. A provider failure is a 503, never a silent success.

### `async verifyEmail(`

Exchanges a right code for an `emailTicket` shaped exactly like the phone
ticket. The audit row carries the domain, never the address or the code.

### `async verifyExisting(`

"Verify now", for dealerships created before verification was required and
still without an owner. The representative proves the dealership's own number
again — `verifyPhone` lets the assisting member, and only them, prove a number
held by an owner-less dealership they assisted — and an email, and the same
`attachOwner` runs. Until it does, the account step of completeness is
incomplete, so the dealership cannot be approved or manually activated.

### `async dashboard(principal: AdminPrincipal): Promise<SalesDashboard>`

A rejection purges the dealer row (the baseline behaviour, kept), so a rejected
assisted dealership is counted from the `dealer.rejected` audit snapshot, which
now records `assistedByMemberId`.

## `apps/api/src/modules/sales/assisted-ticket.ts`

### `export function issueAssistedTicket(`

The proof that a phone or an email was verified has to cross from Step 1 to the
create without the client being trusted to carry the value. A ticket is an HMAC
over the kind, the value, the member id and the proof time (30 minutes), so it
cannot be forged, moved to another representative, used as the other kind, or
outlive the visit.

### `export async function openUnspentTicket(`

Checks a ticket without spending it, so a create that fails a business check
can be retried with the same tickets.

### `export async function redeemAssistedTicket(`

Single use: the ticket's nonce is counted in the `CachePort` before the create
proceeds, so a replayed ticket — or two tabs — produces one dealership.

## `apps/api/src/modules/sales/assisted-email-code.ts`

### `export function issueEmailChallenge(`

No table: `CachePort` only counts, so the challenge itself is the state. It is
signed, bound to the member and the address, expires in 10 minutes, and holds
`HMAC(nonce, email, code)` rather than the code. The counters keyed by the
nonce enforce five attempts and single use.

## `apps/api/src/modules/sales/routes/phone-limit.ts`

### `export function salesPhoneLimit(limit: number, windowSeconds: number)`

The shared `byUser` key reads the signed-in _dealer_ principal and throws for an
admin one, so the Sales OTP routes key their limit on the admin member instead.
An OTP is an SMS, so this is a spend control as much as an abuse one.

### `async vehicles(principal: AdminPrincipal, dealerId: string): Promise<SalesVehiclesResponse>`

**R114.** Scoped twice: the dealership must be one this member assisted
(`requireAssisted`, a 404 otherwise), and the vehicles are the ones this member
created. Writes go through `vehicles.assisted*`, which re-checks the dealership
under its row lock.
