# api / modules/dealer-claims

Parent: [api](README.md)

The notes below belonged to the files named under each heading. Each heading is the
declaration the note sat above.

## `apps/api/src/modules/dealer-claims/dealer-claims.service.ts`

### `export function createDealerClaimsService({ prisma, audit, sessions, proof, identities }: DealerClaimsDeps)`

**R113** — how a dealership a Sales representative set up becomes the dealer's.
Ownership needs **two proofs the representative cannot supply**:

1. the dealer receives mail at the address the representative typed — they open
   the emailed link and confirm with a POST, and
2. the dealer holds the phone that was verified during onboarding — an OTP on
   that number, under its own `DEALER_CLAIM` purpose, which fails closed.

Either alone is worth nothing: the email link without the OTP cannot claim, and
the OTP without the link has nothing to claim. The account that holds the
number (created if there is none) becomes the OWNER and is signed in. The email
is **never** copied onto that account as `users.email` — it proves the dealership
can be written to, not who may sign in.

### `async verifyEmail(token: string): Promise<DealerClaimPreview>`

A POST, not the GET that opens the page: mail scanners and link previewers
fetch every URL in an inbox, and a GET that verified would let a scanner verify
an address nobody read. Verification only counts while the dealership's
`contactEmail` still equals the address the link was sent to.

### `async claim(`

Refused for: an account that is staff in any form (an Admin Member, a platform
admin, an ADMIN seat — a Sales representative must never own a dealership they
assisted), an account with an ACTIVE membership anywhere (the one-dealership
rule onboarding enforces), a dealership that already has an owner, and a
rejected or closed application. The verification row and the dealer row are
locked `FOR UPDATE` in that order, so two simultaneous claims produce one owner
and one `409`.

### `async issueLink(verificationId: string): Promise<ClaimLink | null>`

Called by the email job, not by the request that asked for the email. The raw
token exists only in memory here and in the email: the row stores its SHA-256,
the outbox event and the job carry the verification id. A retry that runs after
the email was SENT is stopped before this is called (see `notifications.md`),
because minting again would invalidate the link the dealer already has.

## `apps/api/src/modules/dealer-claims/email-verification.ts`

### `export async function requestEmailVerification(`

Supersedes every open link for the dealership, then records a new one and
enqueues `DealerEmailVerificationRequested` in the same transaction. Called on
assisted creation, on a change of address, and on an explicit resend (one per
minute per dealership).

## `apps/api/src/modules/dealer-claims/claim-token.ts`

### `export function claimTokenHash(token: string): string`

Domain-separated (`dealer-claim:` prefix) so a claim token can never collide with
a session token hash in a different table.

## `apps/api/src/modules/dealer-claims/routes/post-claim.ts`

Rate-limited per IP and per claimed number. The console mail driver prints the
message text, link included, which is why `env.ts` refuses `MAIL_DRIVER=console`
in production; a shared staging environment on the console driver would log
working claim links.
