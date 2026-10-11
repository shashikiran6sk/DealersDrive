# Independent progressive dealer onboarding — DRAFT

DRAFT — Independent progressive dealer onboarding and verification. Awaiting product and legal review. Do not merge.

## Scope and ancestry

Base: latest main, `d423db1caf9212dab51ee938187234a4660e4f5b`. This branch does not inherit any unmerged campaign stack commit. Existing approved businesses keep their status, ownership, listings and legacy onboarding requirements. Only explicitly registered progressive applications use the new staged policy.

## Register, verify, activate

- Register: verified Google identity and mobile proof remain mandatory for self-registration. Essential representative, dealership and location details plus explicit versioned authorization/consent save a DRAFT. Email comes from the proved identity; a submitted email cannot assign ownership. Registration serializes on the owner user to prevent concurrent duplicate applications.
- Assisted registration: the existing sales permission, representative-handset OTP ticket, single-use redemption, consent and audit attribution remain in place. Entered email stays unverified, and the existing dealer email verification/claim flow establishes ownership. A sales representative cannot approve their application.
- Verify: save partial business details and return later. An independent authorized admin records actual identity, authority and business checks, a reviewed classification, regulatory and GST applicability, protected case references and the required document subset. Uncertain applicability stays pending. The inherited directory cover stamp now says Approved Dealer and makes no yard-verification claim. No yard ownership criterion or universal demand for all three document slots is added. Unmasked Aadhaar is not requested.
- Activate: existing submission, private upload/object checks, document review, proved contact checks, role permissions and database transactions gate approval. Registration alone never makes a dealership public or permits listing publication. Submission rechecks completeness inside the dealer lock; reviews use optimistic versions and a hash of the reviewed business identity. Material changes invalidate the plan. Activated/submitted identity changes require a controlled correction, not an arbitrary profile write.

The staged registration declaration is a proposed product consent, not a representation that legal documents have been approved. Product/legal review must approve wording, applicability rules and the operational protected-case workflow before release.

## Legal review boundary

[MoRTH's official announcement of G.S.R. 901(E)](https://www.pib.gov.in/PressReleaseIframePage.aspx?PRID=1886986&lang=2&reg=48) describes authorization for dealers of registered vehicles. The system distinguishes a reviewed vehicle dealer from a individually reviewed intermediary; it does not assert that every intermediary is exempt. Applicable authorization must actually be checked, or non-applicability must have a documented case review. No automated government verification is claimed.

[CBIC's registration rules](https://cbic-gst.gov.in/gst-registration-rules.html) describe registration procedures for persons liable to register. Optional signup collection does not remove GST obligations. The draft requires an individualized applicability decision; it does not hardcode turnover-based exemptions or treat format validation as an active GST registration check. Current legal/tax advice remains required for classification and operational policy.

PAN and business-address evidence can be required by the individual review plan. Their applicability is deliberately not presented as a universal statutory requirement. Cases needing evidence outside existing document slots must use the restricted case process pending product/legal decisions about additional document types.

## Security and privacy review

New progress responses contain stage, version and requirement flags, never plan references, identity hashes, reviewers' private information or documents. Existing public payload serializers are unchanged and do not include progressive JSON. The private plan is stored only on the dealer row and is not copied into public DTOs. Audit events record actor, time, version, classification and required types without raw document identifiers or private URLs. Case references should point to a protected, retained operational record rather than embed sensitive document data.

Progressive admin payloads redact PAN, document filenames, private review comments and signed URLs from roles without document-review permission.

Existing private presign/commit, storage path validation, object existence checks, role/tenant boundaries and short-lived signed review URLs remain in use. No new general document storage, OCR, Aadhaar collection or credentials are introduced. Existing infrastructure encryption and access policies must be verified by the operator for the actual storage and database service; this draft does not claim that local disk fixtures prove production encryption. Retention/deletion periods and the legal consent basis need owner/legal approval. Do not put KYC records into logs or testing evidence.

Current admin admission and permissions are rechecked under database locks for new plan and activation operations. Own-member and assisting reviewers are refused. A rejected applicable document suspends a newly activated progressive business; reinstatement must recheck current applicable evidence. Existing legacy behavior is preserved.

## Dependencies to reconcile after stack review

The draft is independently executable on main. The unmerged stack is not imported:

- PR 2: reconcile its broader owner-email uniqueness model before eventual integration.
- PR 4: main retains normalized free-text locality fields. Integrate canonical geographic identifiers and enabled-service validation after the approved location model lands.
- PRs 5 and 11: progressive registration omits tagline and GSTIN; legacy general schemas remain unchanged here. Blank progress fields preserve values instead of silently clearing them.
- PR 6: main's admin Google/session model remains the base. The draft does not claim to contain the unmerged isolated admin OTP design.
- PR 10: progressive activation review is scoped to new applications. Reconcile the independent public verification-status model and review history after that stack change lands.

These integration and product/legal decisions are reasons to keep the PR Draft, even after CI is green.

## Migration and rollout

The additive migration adds nullable registration/consent/plan columns and a nonnegative version. Existing rows stay non-progressive and unchanged; no automatic suspension, owner reassignment or destructive backfill occurs. Paired timestamp/consent constraints reject partially marked registration rows. Run normal migration deployment before enabling the new routes. For rollback, disable route discovery and leave additive data intact; do not drop saved applications or review evidence. Re-enable only after the corrected application is validated.

No production deployment or migration has been executed by this campaign.

## Owner UAT

1. Sign in as a new dealer, prove the mobile number, choose basic registration and confirm consent. Save only name and location. Reload and confirm the saved application resumes.
2. Save partial address details. Confirm no universal yard, tagline, GST certificate or PAN upload wall appears before an applicable review.
3. Independently review the business classification, applicable authorization/GST requirement and actual evidence references as an authorized admin. Confirm a stale version or self-review is refused.
4. Upload only the required synthetic document subset in a test environment, submit, review each document and approve. Confirm public/listing activity is unavailable before approval.
5. Repeat through sales-assisted registration; verify the representative's phone and email through the existing flows. Confirm typed email alone cannot activate or establish ownership.
6. Request corrections, reject evidence and resubmit. Confirm changed business identity requires a fresh plan review, and missing/unreviewed evidence blocks activation.
7. Confirm existing approved dealerships retain their current status and behavior. Review on phone, tablet and desktop.
