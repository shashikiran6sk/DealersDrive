# web / features/dealer

Parent: [web](../../README.md)

The notes below belonged to the files named under each heading. Each heading is the
declaration the note sat above.

## `apps/web/src/features/dealer/profile-actions.ts`

### `export async function saveDealerProfileAction`

C2 `PATCH /v1/dealer` — three fields (**R27**).

Which dealer is being edited is never in this payload — the API takes it from
the session (Rule 1). Nor are `status`, `slug` or `creditBalance` accepted by
`DealerSelfUpdateInput`: a dealer cannot verify or fund themselves by editing
their own profile.

And since R27, neither can they edit the record their verification was _about_
— the registered name, the address, the town, the pin, the mobile, the email.
Those are read-only on the form and absent from this schema, which is two
defences for one rule and deliberately so: the disabled inputs are why a
dealer never sends one, and `.strict()` is why it would not be written if
they did.

The payload is therefore built from three keys rather than filtered down from
the form. A form that grows a box nobody meant to accept is the failure this
shape prevents.

### `revalidatePath('/dealer', 'layout')`

The dealership's name is in the console top bar and on every public card.

### `revalidatePublicDealer(saved.slug)`

And on the public pages, which is the half that was missing.

Everything on this form is rendered to buyers — the name, the address, the
Maps link the portfolio draws its map from, the opening hours — and none of
it moved until two ten-minute windows had expired. A dealer correcting
their own pin watched a stale page and reasonably concluded the save had
not worked.

The slug comes off the response rather than the session, because it is the
dealership this PATCH actually wrote: `dealerId` comes from the session on
the API side (rule 1), so the row that answered is the row that changed.

### `export async function withdrawProfileChangeAction(): Promise<string | null>`

C2c — the dealer taking their own proposal back (**R34**).

`DELETE /v1/dealer/profile-change`, and the same two revalidations the save
does. The public pages did not change — the proposal was never published —
but the dealer's own console did, and `revalidatePath('/dealer', 'layout')`
is what re-renders the profile screen with the boxes unlocked.

`revalidatePublicDealer` is kept for the same reason the admin refusal keeps
it: it costs one re-fetch of a page that comes back identical, and leaving it
out would make this the one write path in the file that has to be reasoned
about separately.

A bare `Promise<string | null>` rather than a form state, because there is no
form: the panel renders a button, and the only thing it can usefully say back
is what went wrong.

### `if (error.status === 404)`

A 404 is the ordinary race — a double-click, or a decision that landed

### `if (error.status === 404)`

while the page was open. The screen is stale either way, and re-reading

### `if (error.status === 404)`

it is the fix, so it is not worth an error the dealer has to dismiss.

### `function flatten`

Zod's dotted paths, folded onto the input names the form uses.

`contact.email` is the input named `contactEmail`, and `address.mapsUrl` the
one named `addressMapsUrl`. One function does it for both the local parse and
the API's refusal, because the two answer in the same vocabulary and a form
that highlighted the right box for one and not the other would be a puzzle
to debug.

### `function mapApiFields(errors: Record<string, string>): Record<string, string>`

`validate()` has already stripped the `body.` prefix; the shape is the same.

## `apps/web/src/features/dealer/billing/credit-packs.tsx`

The purchase runs order → Razorpay Checkout → verify. The order and verify are
Server Actions, so the API session cookie never reaches the browser; Checkout's
script is loaded on first use from `checkout.razorpay.com` and opened with the
server's order id, key id and amount — the browser never chooses a price. Where
the API runs the `fake` gateway the checkout carries a simulation and the panel
offers a test payment instead of loading the script.

The terms of a purchase — one-off, never expiring, not refundable — sit under the
packs, before the dealer pays rather than after, with a link to the full policy
and what to do if money left their account without credits arriving. A paid order
in the dealer's payments shows its Razorpay payment id, the reference support
asks for.

## `apps/web/src/features/dealer/billing/razorpay.ts`

### `openCheckout(checkout)`

Resolves once, with what finally happened in the Checkout window. A
`payment.failed` event is **not** an outcome: Razorpay keeps the window open
after a declined attempt and offers a retry, so resolving there stopped the
page listening, and a retry that then succeeded was never verified — the page
said "you have not been charged" while the dealer had paid, and the credits
waited for the webhook or the re-check job. A failed attempt is only remembered;
the promise resolves on the success handler (`paid`), or on the window closing
(`failed` if any attempt failed, `dismissed` if none was made).

## `apps/web/src/features/dealer/billing/credits-policy.constants.ts`

### `CREDITS_POLICY`

The credits, cancellations and refunds policy at `/credits-and-refunds`, which
Razorpay requires a merchant's site to publish. It is rendered by the same
`LegalDocument` as the Terms and Privacy pages, and shown under the same
`legalPagesVisible()` switch, but it is deliberately **not** a third versioned
legal document: the legal v1 sources are exactly two acceptance-bearing documents
(`packages/contracts/src/legal-documents/README.md`), and this one asks no one to
accept anything. It states what the product does — holds at submission, use on
approval, return on rejection, no expiry, no refund of bought credits, correction
of a payment that was taken but not credited. Its effective date is left empty, so
the page reads "pending", until the owner approves the wording.

## `apps/web/src/components/dealer/console-nav/utils.ts`

### `consoleNavFor(permissions, billing)`

The Billing item has existed since the nav was drawn, hidden as not yet built. It
appears now only when listing credits are on and the member may read billing; the
layout's read of the summary is optional, so the console renders without it.
