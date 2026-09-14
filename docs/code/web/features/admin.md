# web / features/admin

Parent: [web](../../README.md)

The notes below belonged to the files named under each heading. Each heading is the
declaration the note sat above.

## `apps/web/src/features/admin/access-actions.ts`

### `export async function grantAdminAccessAction(input:`

Who may open the admin console (**R42**).

This is the most consequential write on the settings screen and the only one
that hands somebody a cross-tenant seat, so it goes through the same
`.strict()` contract the API validates with before the request leaves — a
typo'd field becomes a message in the form rather than a 400 to interpret.

The address is lower-cased and trimmed by the schema, on both sides, because
the value on the left was typed by a person and the value it will eventually
be compared against came out of a Google identity token.

## `apps/web/src/features/admin/actions.ts`

### `export interface AdminResult<T = undefined>`

Admin moderation (D4, D6, D9–D12).

These are the actions that move credits and change what the public can see.
Approving a dealership is the one that matters most here: public visibility
requires `dealer.status === 'ACTIVE'` as well as an approved listing, so this
single write is what puts a dealership's whole catalogue in front of buyers —
and suspending is what takes all of it away again, at once (rule 6).

Every action re-parses its input against the same contract the API validates
with, before the request leaves. That is not belt-and-braces: it turns a
typo'd field into a message in the form rather than a 400 the user has to
interpret, and it is free, because the schema already exists.

── Reconstruction slice ────────────────────────────────────────────────────
The baseline file also carries the four listing decisions (**F070**, F071)
and `grantCreditsAction` (**F054**). Each lands with the endpoint it calls.

`reinstateDealerAction` and the two document decisions are **not** ports.
The baseline console called none of them: the endpoints existed and were
documented, and nothing in the UI reached them. That left two dead ends a
moderator could walk into and not walk out of. A suspended dealership could
only be brought back through the API, and — worse — a document could only be
_verified_ through the API, which meant `canApprove` (which requires all
three verified) was never true and the approve button never appeared at all.
The three actions below are what make the console's own state machine
traversable.
────────────────────────────────────────────────────────────────────────────

### `function refreshAdmin(slug?: string): void`

The console's own pages, and the public ones the decision just changed.

The second half was missing, and on these paths it is the half that matters:
public visibility is `dealer.status === 'ACTIVE'` (rule 6), so a suspension
is the write that takes a dealership off the marketplace — and the portfolio
went on being served from Next's cache for up to ten minutes afterwards. A
dealership suspended for cause staying up for ten minutes is not untidiness.

`slug` is passed in rather than read off the response because
`DealerModerationResponse` carries an id and no slug, and every caller is a
screen already rendering `AdminDealerDetail`. Omitting it still clears the
directory and the header, so a caller that forgets degrades to the old
behaviour on one page rather than breaking.

### `export async function reinstateDealerAction`

Suspension is not a terminal state, and the console should not treat it as
one. This is the way back: SUSPENDED → ACTIVE, which restores every listing
the suspension pulled out of the catalogue (rule 6).

### `export async function verifyDocumentAction`

D5. The two KYC decisions.

Approving a dealership requires all three documents verified, and verifying
one was previously an API-only action — so the approve control was
unreachable from the console by construction. These are what close that loop.

### `if (!parsed.success) return { ok: false, message: 'A rejection needs a reason.' }`

The dealer reads this verbatim and re-uploads against it, so it is the one

### `if (!parsed.success) return { ok: false, message: 'A rejection needs a reason.' }`

field on this screen that cannot be left to a default.

### `export async function rejectDealerAction`

The destructive refusal.

It does not set a status — it deletes the application: the KYC scans and the
yard photograph go from storage, the dealership row goes with its documents
and its membership, and the applicant is left able to start onboarding afresh
as a first-time applicant.

The dealership no longer exists when this returns, so the caller must
navigate away rather than refresh: `/admin/dealers/{id}` is a 404 from here
on. `requestDealerChangesAction` below is the reversible answer, and is the
one a moderator wants nine times in ten.

### `export async function requestDealerChangesAction`

The reversible refusal: PENDING_APPROVAL → DRAFT with the reason attached.

Nothing is deleted. The dealer signs in to their own form again, filled in,
with the reason at the top of it — which is what "the GST certificate is
unreadable" actually calls for, and what rejecting would answer by throwing a
real business's whole application away.

### `if (!parsed.success) return { ok: false, message: 'Say what the dealer needs to change.' }`

The dealer reads it verbatim and corrects against it, so it is the one

### `if (!parsed.success) return { ok: false, message: 'Say what the dealer needs to change.' }`

field on this control that cannot be left to a default.

### `export async function updateDealerAction`

D3 — the console amending the dealer's own answers.

Parsed against `UpdateDealerInput`, the same schema the API validates with
and the same one `PATCH /v1/dealer` takes, so a GSTIN the API would refuse is
marked against the box the admin typed it into rather than coming back as a
400 to interpret.

### `refreshAdmin(data.slug)`

This one answers with the dealership, so the slug is the row that was

### `refreshAdmin(data.slug)`

actually written rather than one the caller believed in.

### `const data = await apiSend<DealerModerationResponse>`

Suspending hides every one of this dealer's listings at once: public

### `const data = await apiSend<DealerModerationResponse>`

visibility requires `dealer.status === ACTIVE` as well as an approved

### `const data = await apiSend<DealerModerationResponse>`

listing (Rule 6).

### `export async function approveProfileChangeAction`

D3b — publishing or refusing a dealer's proposed words (**R34**).

Both actions clear the public pages off the **response**, not off a slug the
console was rendering with. `ProfileChangeDecisionResponse.dealerSlug` is the
row the API actually wrote, which is the only trustworthy answer to "which
portfolio changed" — a moderator with two tabs open would otherwise clear
whichever dealership they last looked at.

A refusal clears them too, and that is not wasted work: nothing about the
dealership moved, but the console's own dealer list and the review card did,
and `refreshAdmin` is what re-renders those. The public tags being dropped as
well costs one re-fetch of a page that will come back identical.

### `const parsed = ReasonInput.safeParse(input)`

Re-parsed here as well as at the API, for the reason every action in this
file does it: a six-character floor enforced only server-side reaches the
moderator as a 400 they have to interpret. The floor itself is the point —
this sentence is the whole of what the dealer will be told.

## `apps/web/src/features/admin/config-actions.ts`

### `export async function updateConfigAction`

D14 — platform configuration.

These values govern money and moderation (GST percent, listing duration,
minimum photos, rate limits), so each one is written individually with its
declared type rather than as a blob PATCH — a string where a number belongs
would silently change what a credit costs.

### `revalidatePublicConfig()`

Some of these keys are rendered on public pages — the social links in
the footer are (**R44**) — and those pages hold the payload for ten
minutes. Clearing the tag unconditionally rather than only for the keys
that are public: the set of public keys is a fact about the API, and a
second copy of it here would be wrong the first time one is added.
