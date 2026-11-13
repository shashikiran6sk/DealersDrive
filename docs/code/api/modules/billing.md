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
| `billing.gstPercent`        | `18`                               | added to every order                   |

With the defaults a car the dealer photographs is one credit (₹500) and a
Dealers-Drive photoshoot is two (₹1,000), before GST. The difference is the
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

## `apps/api/src/modules/billing/listing-credits.ts`

### `export async function holdForSubmission(tx, config, listing, plan, actor)`

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

### `async adjust(admin, dealerId, input)`

`ADMIN_GRANT` / `ADMIN_DEDUCT` (**F054**), super admin only, always with a note
the dealer reads in their ledger. This is how the existing dealerships get launch
credits before the feature is switched on.
