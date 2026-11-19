# api / modules/billing

Parent: [api](../../README.md)

Listing credits and the payment gateway (**F050–F054**, revised; lands the tier
**R47** deferred). A credit is the unit a listing is paid in. Submitting a car
**holds** its cost, an approval **consumes** the hold and a rejection
**releases** it, so a dealership pays only for cars that go live. A request for
changes keeps the hold; a resubmission adjusts it to the current cost of the
photo plan (`HOLD_ADJUST`).

Everything is behind `feature.listingCredits`, which ships **off**. With it off
nothing is held at submission, and an approval or rejection settles only what is
already held — zero for every listing that predates the feature. So switching it
on never charges for a car already in review, and switching it off mid-flight
still settles the holds that exist.

## Pricing

What a car costs is two admin-configurable numbers, and what a credit costs is a
third:

| Key                         | Default                            | Meaning                                |
| --------------------------- | ---------------------------------- | -------------------------------------- |
| `billing.listingCredits`    | `1`                                | every submission                       |
| `billing.photoshootCredits` | `1`                                | added when the plan is `DEALERS_DRIVE` |
| `billing.creditPacks`       | `1=50000`, `5=225000`, `10=400000` | `credits=pricePaise`, before GST       |
| `billing.gstPercent`        | `0`                                | added to every order                   |
| `billing.welcomeCredits`    | `5`                                | granted once, on first activation      |

With the defaults a car the dealer photographs is one credit (₹500) and a
Dealers-Drive photoshoot is two (₹1,000).

GST defaults to **0** because Dealers-Drive is not GST-registered, and a business
that is not registered may not collect GST — the dealer would pay 18% more that
could neither be remitted nor claimed back. At 0 every surface drops GST rather
than showing "+ 0% GST": the packs show the price alone (`gstPercent` is on the
packs response and on the billing summary for that), the photo-plan cards read
"1 credit = ₹500", and the tax note says no GST is charged. Registering later is
one setting: `billing.gstPercent` to 18, and orders from then on carry the tax.
Tax invoices (F053) belong with that change, not before it. The difference is the
cost of the visit: both plans pay for review and StudioCar processing; only the
photoshoot sends a person to the yard. A listing with no plan — every one
submitted before plans existed, and every one a Sales Representative submits —
costs the base only.

The values are read at the moment they matter and snapshotted: an order stores
its amount, tax and total when it is created, and a listing stores the credits it
holds. A price change in the admin console therefore never alters an order in
flight or a car already in review. `CONFIG_VALIDATORS` in
`platform/config/platform-config.ts` refuses a pack list that does not parse and
a credit cost outside a sane range, so a typo cannot take checkout down.

## `apps/api/src/modules/billing/credits.ts`

### `export async function moveCredits(tx, move)`

The only writer of a balance (rule 4). It locks the dealer row `FOR UPDATE`,
reads the newest ledger row — the authoritative balance; `dealers.creditBalance`
and `dealers.creditsHeld` are mirrors it updates — computes the new balance and
hold, refuses a movement that would leave either negative or the hold above the
balance, and writes one `credit_transactions` row. A hold that does not fit is
`422 INSUFFICIENT_CREDITS` with `required`, `available` and a Buy credits action;
any other impossible movement is `422 CREDITS_NEGATIVE`.

The ledger id is a `BIGSERIAL`, not a uuid, because "newest row" must be a total
order: `now()` is the transaction's start time in Postgres, so two movements in
one transaction share a `createdAt`.

The database repeats the rule: CHECK constraints on `dealers` and on every ledger
row (`heldAfter <= balanceAfter`, both non-negative), and a partial unique index
that lets an order be fulfilled once — `UNIQUE (orderId) WHERE reason = 'PURCHASE'`.

## `apps/api/src/modules/billing/welcome-credits.ts`

### `export async function grantWelcomeCredits(tx, config, dealerId, actor)`

A dealership gets `billing.welcomeCredits` (default 5) free, once, when it is first
activated — by approval or by manual override — in the activation's own
transaction, so a failed activation grants nothing. It is a `WELCOME_GRANT` row,
not `ADMIN_GRANT`, so free credits stay distinguishable from manual corrections in
any report. "Once" is checked here and enforced by
`credit_transactions_one_welcome_grant`, a partial unique index on `dealerId`;
suspension and reinstatement never call this, and a second call returns 0.

It runs whatever `feature.listingCredits` says, so a dealership approved before
credits are switched on still has its five when they are. Dealerships approved
before this existed were given theirs by `20261119090200_welcome_credits_backfill`
— a ledger row on top of each one's newest row, mirrored onto `dealers`, skipping
any that already has one — with the default of five written into the SQL, since a
migration cannot read the admin's setting. Setting `billing.welcomeCredits` to 0
turns grants off from then on.

## `apps/api/src/modules/billing/listing-credits.ts`

### `export async function holdForSubmission(tx, config, listing, plan, actor)`

A Sales Representative short of credits gets their own sentence — the dealership
has too few, its owner can buy them, a super admin can add them — instead of the
dealer's "You have …", which reads as if the rep were the one paying and offers a
Buy credits link the rep cannot use. It is checked under the same dealer-row lock
`moveCredits` then takes, so the two cannot disagree.

Called by the submission gate inside the submit transaction, after the listing is
locked and before `transition()`. It moves the hold to exactly the current cost,
so a first submission holds and a resubmission with a different plan adjusts;
either way a failure rolls the submission back with nothing changed.

### `export async function settleListingCredits(tx, listing, outcome, actor)`

Called by `transition()` on `approve` (consume) and `reject` (release). It settles
`listing.creditsHeld` — what _this listing_ holds — rather than the configured
cost, which is what makes the rollout safe for listings submitted before credits.

## `apps/api/src/modules/billing/billing.service.ts`

### `async createOrder(actor, input)`

The client names a pack, never an amount. The order id is generated first and
passed to Razorpay as the receipt and in `notes`, then the row is written with
Razorpay's order id. If the insert fails after Razorpay created an order, that
order is simply never paid; a webhook for it finds no row and is recorded as
`ignored:unknown-order`.

With the `fake` gateway the checkout carries `simulation` — a payment id and a
valid signature — so development and tests run the real verify path without a
card. `env.ts` refuses `fake` in production.

### `async verify(actor, orderId, input)`

The browser's Checkout success handler. The signature is checked against the
order's own gateway id (a payload for another order is a mismatch, logged), then
the payment is confirmed with Razorpay and captured if it is only authorized, and
its amount compared with the order's total. Only then are credits added.

The original specification said verify "never credits — the webhook is the only
writer". Razorpay's own guidance is to fulfil on a verified signature, and doing
so means a dealer sees their credits immediately rather than polling. Both paths
call one idempotent `fulfil()`, which locks the order row and returns early when
it is already `PAID`; the partial unique index above is the backstop.

### `async webhook(delivery)`

`X-Razorpay-Signature` is an HMAC of the **raw** body, so the JSON parser keeps
the bytes for `/v1/webhooks/*` (`middleware/raw-body.ts`). Each event is stored
once in `payment_webhook_events` by its event id; a redelivery is answered
`duplicate`. An event whose processing threw is left unprocessed, so Razorpay's
retry runs it again. `payment.captured` and `order.paid` fulfil when the amount
matches; `payment.failed` marks an order that is still open — a later successful
attempt on the same order (Razorpay allows retries) still fulfils it.

### `function settleFromGateway(order, actor)`

The one answer to "was this order paid?" when neither the browser nor the webhook
said so — a dealer who closed the tab, a webhook that was never configured, or one
Razorpay gave up retrying after 24 hours. It asks Razorpay for the order's payments
and credits a captured one through the same `fulfil()` as checkout and webhook, so
it can never credit twice; an authorized one is captured first, as `verify` does.
A payment of a different amount is `mismatch` and credits nothing: that needs a
person with the Razorpay dashboard, not a guess.

### `async recheckOpenOrders(now)`

The `billing.recheck-orders` job, every ten minutes on the worker. It takes open
and failed orders between 15 minutes old (time for checkout to finish on its own)
and 72 hours (past which a forgotten checkout is not worth asking about; the
admin's button still works), each at most once an hour by `checkedAt`, 25 a run.
An abandoned checkout therefore costs a few dozen Razorpay calls, not hundreds,
and one order Razorpay cannot answer for does not stop the rest.

### `async recheckOrder(admin, dealerId, orderId)`

**Check with Razorpay** on the admin dealer page, for "money left my account but I
got no credits". Super admin only, like every other change to credits. Audited as
`billing.order_rechecked` with the outcome, whatever it was, so the record shows a
complaint was looked into. Every order row now carries Razorpay's order and payment
ids so the reference a dealer quotes can be found without the dashboard.

### `async adjust(admin, dealerId, input)`

`ADMIN_GRANT` / `ADMIN_DEDUCT` (**F054**), super admin only, always with a note
the dealer reads in their ledger. This is how the existing dealerships get launch
credits before the feature is switched on.
