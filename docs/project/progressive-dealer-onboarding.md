# Progressive dealer onboarding — DRAFT

**Draft PR #299. Awaiting product and legal review. Do not merge.** Nothing here
has been deployed, and no production data has been read or changed.

A dealership can be registered in stages, reviewed by document category, and —
as a recorded, revocable exception — activated before its documents are
verified. Business photographs move out of onboarding into a moderated
portfolio, and the physical yard becomes internal evidence rather than a
requirement.

## The stages

| Step | What it collects                                                                                                       | Who must finish it                                                                      |
| ---- | ---------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| 1    | Account: a verified mobile number **and** a verified email, consent. Self-onboarding: Google (email) + phone OTP       | Dealer, or the sales representative with the dealer's handset and inbox                 |
| 2    | Business details: legal name, address, district, state, pin, Maps link, services; GSTIN/PAN if any — Save and continue | Dealer, or the sales representative — **the representative's mandatory work ends here** |
| 3    | Documents: one Personal Identity Proof and one Business Identity Proof (a separate page)                               | Dealer from their own account, or the representative if the dealer hands them over      |
| 4    | Submit for review                                                                                                      | Dealer or representative, once steps 1–3 are complete                                   |

### Verify first (assisted onboarding)

The representative cannot save anything until Step 1 has proved both contact
points: an OTP on the dealer's mobile and a 6-digit code emailed to the dealer
(10 minutes, 5 attempts, one resend a minute, five an hour; sent through the
configured mailer — Resend in production). The account those two prove — an
existing one, or a new one — becomes the dealership's **OWNER** in the same
transaction that creates the draft. The dealer then signs in with Google on that
email, or with a phone code on that number, and lands in the dealership. There
is no claim link and no claim email any more.

- Refused: a staff account as owner, an account that already belongs to a
  dealership, and a phone and an email that belong to two different accounts.
- Google sign-in links automatically only when both sides verified the same
  email (our code, Google's token) and the account owns a dealership.
- Approval and manual activation require the owner's verified phone **and**
  email (`CONTACT_NOT_VERIFIED`).
- Dealerships assisted before this change have no owner. The representative
  opens one and uses **Verify now**: the dealership's own mobile by OTP and an
  email by code. Until then it cannot be approved. The `dealer_email_verifications`
  table is no longer written; it is kept (no destructive migration) and can be
  dropped once no row is needed.

A DRAFT is saved without documents. Documents are needed only to **submit**.

## Document categories

One document per category; the dealer chooses which.

| Category                | Accepted types                                                                                                                                                                     |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Personal Identity Proof | Aadhaar (**voluntary**, masked), PAN card, Voter ID, Driving licence, Passport                                                                                                     |
| Business Identity Proof | Shop & Establishment certificate, GST certificate, Udyam registration, Trade licence, Business registration, Partnership registration, RTO dealer authorisation, Other (described) |

- With a GSTIN on file, the business proof must be the **GST certificate**
  (`docs/project/optional-gstin.md`).
- "Other business certificate" requires a description of what it is and who
  issued it.
- PDF, JPEG or PNG, at most 5 MB. The declared type, the file extension and the
  bytes actually stored must agree: the API reads the object back at commit and
  sniffs it, and a mismatch is refused and the object deleted.
- Files are private. Reviewers read them through five-minute signed URLs, and
  every issued URL is audited.
- Dealerships approved under the three-document model keep their rows: PAN
  card files as Personal Identity Proof, GST certificate as Business Identity
  Proof, and the address proof as a legacy _supporting_ document. The legacy
  PAN + address-proof set still satisfies the requirement, so no approved
  dealership becomes incomplete.

## Separate state machines

Each of these moves on its own; none implies another.

- **Dealership** — `DRAFT → PENDING_APPROVAL → ACTIVE ⇄ SUSPENDED`, plus
  `REJECTED` (purge) and `CLOSED`. Unchanged by this PR except for the override.
- **Document (per category)** — `REQUIRED → UPLOADED → VERIFIED | REJECTED`.
  `VERIFIED → REJECTED` is a revocation, with a reason. Every resubmission
  increments `submissionCount`; the admin page shows the history.
- **Activation method** — `STANDARD` (both categories verified, standard
  approval) or `MANUAL_OVERRIDE`. A manual activation becomes `STANDARD`
  automatically once both categories are verified.
- **Dealer Verified badge** — the independent review from #297. Nothing in this
  PR grants it; a manual activation never does.
- **Portfolio photograph** — `PENDING → APPROVED | REJECTED`; `APPROVED →
REMOVED` by replacement, take-down or the dealer's own removal.
- **Yard visit** — append-only records; no state.

## Dealer Verified decision, simplified

The #297 verification form asked the reviewer to type ten free-text
assessments before granting Dealer Verified. This PR removes them: the decision
is the next status and, for a rejection or revocation, a reason. The API still
refuses VERIFIED unless the dealership is ACTIVE, its contact details are proved
and both document categories were verified and are on file — facts it checks
rather than asks the reviewer to restate. See `docs/project/dealer-verification.md`
(policy v2).

## Controlled activation override

A Super admin may activate a dealership whose documents are not verified.

- Requires a justification of at least 40 characters, acknowledgement of the
  versioned disclaimer, and — when no GSTIN is on file — a recorded GST
  applicability review.
- Refused unless the dealership is DRAFT or PENDING_APPROVAL, the account and
  phone checks and the business details are complete, and no submitted document
  stands rejected. When both categories are already verified it is refused in
  favour of standard approval. The assisting representative and members of the
  dealership cannot decide it.
- It **never** marks a document verified and **never** grants Dealer
  Verified. The outstanding categories stay visible on the admin page.
- Re-checked under the admin membership lock; audited as
  `dealer.activation_overridden` with the disclaimer version and justification.
- Revocable with a reason: the dealership returns to PENDING_APPROVAL, its
  listings leave the marketplace, and any Dealer Verified status is revoked.

## Portfolio photographs

Replaces the yard photograph onboarding used to collect.

- Optional, at most eight (pending and approved together; a replacement does
  not count). JPEG, PNG or WebP up to 10 MB, sniffed at commit.
- Every new or replacement photograph is private and PENDING until a reviewer
  approves it. Only APPROVED photographs of an ACTIVE dealership are served —
  `media.serve()` checks both — so a suspension hides them at once.
- **Safe replacement:** a replacement names the approved photograph it would
  replace. The approved one stays public until the replacement is approved;
  then the two swap in one locked transaction. One pending replacement per
  photograph (partial unique index). A rejected replacement leaves the original
  in place.
- The public profile shows the approved photographs, the first as its cover.
  **Directory cards keep the one standard image (#289).**
- Portfolio photographs are not identity evidence and never affect
  completeness, approval or Dealer Verified.

## Internal yard visits

Staff record what they found at a dealership: date, outcome
(`YARD_CONFIRMED`, `NO_PHYSICAL_YARD`, `NOT_ACCESSIBLE`), notes and photographs.
Private operational evidence: signed reads only, audited, never public, never
required, and never a route to Dealer Verified. `NO_PHYSICAL_YARD` is a
legitimate outcome — many dealerships trade from an office or from the road —
and is not a penalty.

## Permissions

| Permission                  | Roles                  | Grants                                 |
| --------------------------- | ---------------------- | -------------------------------------- |
| `admin:document:review`     | Moderator, Super admin | Verify, reject and revoke documents    |
| `admin:activation:override` | Super admin            | Manual activation and its revocation   |
| `admin:portfolio:moderate`  | Moderator, Super admin | Approve, reject, take down photographs |
| `admin:visit:manage`        | Moderator, Super admin | Record and read yard visits            |
| `document:upload`           | Dealer owner           | Upload identity and business proofs    |
| `dealer:update`             | Dealer owner           | Manage portfolio photographs           |

## Migrations and rollout

All three are additive. No row is deleted, no object is removed, no owner or
status changes.

1. `20261012090000_dealer_document_categories` — adds `category`,
   `description`, `mimeType`, `bytes`, `uploadedAt`, `submissionCount`; files
   every existing row under its category; one document per category per
   dealership; CHECKs tie type to category and description to "Other".
2. `20261012100000_dealer_activation_override` — adds `activationMethod` and
   the override columns; existing ACTIVE and SUSPENDED dealerships are
   `STANDARD`.
3. `20261012110000_dealer_portfolio_and_yard_visits` — portfolio and yard-visit
   tables. A legacy yard photograph becomes an APPROVED legacy portfolio
   photograph for ACTIVE/SUSPENDED dealerships (their public page is
   unchanged) and a PENDING one for DRAFT/PENDING_APPROVAL (a reviewer decides
   it first); CLOSED/REJECTED dealerships carry nothing. `coverMediaId` is not
   touched.

Each migration has a rehearsal test against a database migrated to the
previous step. Deploy order: migrations, then API, then web — the web depends
on the new routes. Rollback: redeploy the previous API and web; leave the
additive columns and tables in place (the previous code ignores them). Do not
drop them while any data might be needed.

**Before production:** take a count of dealerships by status with a legacy
cover (`SELECT d.status, count(*) FROM dealers d JOIN media m ON m.id =
d."coverMediaId" WHERE m.status = 'READY' GROUP BY 1`) so the PENDING queue
the migration creates is expected, not a surprise.

## Privacy and legal assumptions — for review

These are assumptions, not legal conclusions. Each needs owner and legal sign-off.

- **Aadhaar** is voluntary and never required; the UI asks for a masked copy
  showing only the last four digits. The system does not mask automatically,
  verify Aadhaar, or perform e-KYC. Whether to accept unmasked copies at all,
  and the retention period for any Aadhaar copy, need a decision.
- **No government verification is claimed.** A reviewer reads the document;
  format validation of GSTIN/PAN is not proof of registration.
- **RTO dealer authorisation** (the trade authorisation for dealers in
  registered vehicles, G.S.R. 901(E)) is accepted as a business proof but not
  required. Whether it must be required for some dealer classes is a legal
  question this PR does not answer.
- **Manual activation** lets an unverified business list vehicles. The
  disclaimer text and its version (`manual-activation-2026-10-12`) need legal
  approval, as does the policy that decides when the exception is permitted.
- **Retention**: documents, yard-visit photographs and replaced portfolio
  photographs are kept until the dealership is rejected (purged) or a sweeper
  removes orphaned media. A retention schedule is not implemented.
- **Storage encryption and access** depend on the deployed bucket and
  database configuration, which this PR does not change and cannot prove.
- **Yard-visit photographs** may show people or vehicles; staff guidance on
  what to photograph is an operational decision.

## Product decisions recorded in this PR

- The Dealer Verified decision is a status and a reason; no typed assessment.
- Sales representatives are done at Step 2; everything after is optional for them.
- A draft needs no documents; submission needs one per category.
- One document per category, not a checklist of every type.
- Rejecting a verified document is how a verification is revoked; the dealer resubmits.
- The override is Super-admin only, never verifies, never badges, and is revocable.
- Portfolio photographs are moderated before publication, with safe replacement.
- Yard visits are internal, optional and non-penalising.
- Directory cards keep the standard image (#289); Dealer Verified semantics are unchanged (#297).

## Owner UAT

1. Register a dealership; save step 2 with no documents. Reload — the draft resumes. Try to submit: it asks for one proof per category.
2. Upload a PAN card (personal) and a Shop & Establishment certificate (business); try Aadhaar and read the voluntary hint; try "Other" and confirm a description is required. Add a GSTIN and confirm the business proof must be the GST certificate.
3. Upload a renamed `.exe` as a PDF and confirm it is refused.
4. As a sales representative, create a draft, save step 2 and confirm the page says your part is done.
5. As a Moderator, verify one category and reject the other with a reason; as the dealer, resubmit; as the Moderator, verify, then revoke the verification and see the history.
6. As a Super admin, try the override with the disclaimer unticked and with a short justification (refused), then activate. Confirm the dealer page warns "documents not verified", no document shows verified, and the public page has no Dealer Verified badge. Revoke and confirm the dealership is back in review.
7. As the dealer, add three photographs, then replace an approved one: the original stays on the public page until the replacement is approved. Reject a replacement and confirm the original remains. Suspend the dealership and confirm its photographs stop loading.
8. Record a yard visit with `NO_PHYSICAL_YARD` and a photograph; confirm it is not on the public page and a Support admin cannot open it.
9. Repeat on a phone-sized screen.
