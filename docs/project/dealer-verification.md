# Dealer verification policy and rollout

Approval (`Dealer.status`) and verification (`Dealer.verificationStatus`) are independent.
Approval permits the existing marketplace workflow. The Dealer Verified badge follows a
separate recorded business/representative review. Yard ownership, photographs, listing
moderation, vehicle inspection and ownership of every vehicle are not evidence of this badge.
The standard directory image remains identical for every card.

## Policy v1

Only current admitted MODERATOR/SUPER_ADMIN reviewers can read assessment history and decide.
The API rechecks membership and role within the transaction. A dealership member or the person
who assisted its onboarding cannot self-review, even after obtaining an admin seat.
A row lock plus expected version rejects conflicting decisions. Every change records the
administrator, time, previous/new status, reason, assessment and policy version atomically
in the existing restricted audit log. UI history shows the latest 100; full history remains.

NOT_VERIFIED → PENDING or IN_REVIEW; PENDING → IN_REVIEW or REJECTED; IN_REVIEW → VERIFIED
or REJECTED; VERIFIED → REVOKED; rejected/revoked can begin a fresh review. Reasons are
required for rejection/revocation. Direct creation of VERIFIED is refused.

To decide VERIFIED, the business must separately be ACTIVE. Its representative's email and
phone must actually be proved (self-onboarded values must match the owner; assisted records
use the existing linked contact proofs). Applicable private PAN/address documents must have
been reviewed by an administrator and still exist in protected storage. Supplied GSTIN also
requires reviewed GST evidence and a recorded registration check. Absence requires an explicit
reviewed non-requirement assessment; a format match is never a registration check.
PAN/address evidence here is the existing **platform** policy, not an invented universal law.

The reviewer records checks actually performed: identity, authority to represent the business,
business existence, contact validation, legal classification, applicable regulatory authorization
and GST applicability. Use protected case/document references, never raw PAN/Aadhaar, OTPs or
signed private URLs in notes. Text fields escape on rendering. Public DTOs carry only the safe
boolean, never assessment notes, documents, reviewer identifiers or PAN. Existing public GSTIN display remains a business contact field,
not proof of active registration.
SUPPORT members do not receive private KYC files, names/rejection notes or PAN/GST identifiers
from the dealer detail response. Existing admin admission still protects all routes.

Classification is explicit. A dealer of registered vehicles requires CHECKED_VALID regulatory
authorization; a reviewed intermediary classification may record reviewed non-applicability
with its legal case reference. Uncertain classification must remain IN_REVIEW. The interface
cannot prove that an administrator performed an external check; audit attribution and protected
evidence references are the accountable review record. No automatic government verification
or legal exemption determination is claimed.

Government references reviewed for this policy:

- [MoRTH's official notification announcement](https://www.pib.gov.in/PressReleaseIframePage.aspx?PRID=1886986&lang=2&reg=48).
- [Final G.S.R. 901(E), 22 December 2022](https://static.pib.gov.in/WriteReadData/specificdocs/documents/2022/dec/doc20221228148101.pdf), rule 55A and Form 29B; effective 1 April 2023. The final notification is used, not the earlier draft.
- [CGST Act, CBIC](https://cbic-gst.gov.in/pdf/CGST-Act-Updated-31082021.pdf), sections 22–25, distinguishes registration liability and voluntary registration. This dated consolidated text is a starting reference, not a complete current tax determination; later amendments/exemptions and actual dealer facts require legal review. No universal turnover threshold is hard-coded.

Owner/legal review must establish the operating classification and actual applicable authorization
checks before granting real-world badges. Optional collection does not eliminate tax/regulatory
obligations. This policy does not promise vehicle inspection, yard ownership or guaranteed condition.

## Evidence changes

Changing core business identity, applicable tax identity, representative name/contact or business
address revokes an existing VERIFIED badge inside the same transaction. Previously verified
business documents become UPLOADED again with review metadata cleared, preserving their bytes
for a new actual review. Rejecting reviewed documentation also revokes the badge. The change is
audited. Marketing/tagline/service changes do not revoke verification. Suspension hides a business
through existing ACTIVE marketplace filtering; verification is not a substitute for suspension.

## Compatibility and deployment

`20261010150000_dealer_verification` is additive and transactional. Existing dealers start
NOT_VERIFIED without changing approval, membership, ownership, listings or documents. There is
no fabricated backfill from ACTIVE or old yard photographs. DB constraints require verification
time/reviewer for VERIFIED and nonnegative version. Reviewer identifiers remain as historical
identifiers when an admin account is removed, consistent with the audit log.

Deploy schema first, then compatible APIs/web; drain old writers before enabling this new review
workflow because they cannot revoke the new badge on evidence changes. Existing public badges
become absent until a genuine review is recorded; public directory and listing visibility is
preserved for approved businesses. The change also removes universal identity/GST/yard verification
claims from public copy and SEO. Rollback before writes is transactionally rehearsed; after real
writes prefer a forward fix to retain verification history and avoid an old writer's weaker semantics.
No production migration, seed, reset or deployment is executed by this campaign.

## Owner UAT

1. Open an approved unverified business: no Dealer Verified badge, including suggestions/car cards.
2. As a reviewer, open its admin detail and start IN_REVIEW. Review private evidence independently
   of any yard image. Record all performed checks and applicable legal/tax outcomes.
3. Save VERIFIED; verify directory/detail/vehicle dealer badges and truthful explanatory wording.
4. Use a business without a yard and, where properly reviewed, without GSTIN. Yard photos do not
   affect qualification. Registration obligations still apply where required.
5. Reject/revoke with a reason; confirm badge disappears and restricted history records the actor/time.
6. Edit core evidence or reject an applicable document; confirm automatic revocation/new document
   review without disabling the business. Marketing edits do not revoke.
7. Try dealer/staff/sales/SUPPORT actors, assisting reviewer, forged requests and concurrent versions.
   They must not bypass role, self-review, evidence or concurrency controls.
8. Inspect public responses for document/assessment/identifier leakage and mobile/desktop layout.

Post-creation browser UAT found public profile data remained cached after a verification
write even though the API returned the correct badge state. Verification actions now
invalidate the existing dealer and vehicle cache tags, covering directory/detail/suggestions
and vehicle dealer badges. The regression checks both tags; browser UAT repeats verification
and revocation after first visiting the cached public page. Existing core-edit/document-review
admin actions already invalidate those same tags.
