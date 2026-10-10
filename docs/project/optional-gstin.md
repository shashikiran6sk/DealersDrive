# Optional GSTIN

General onboarding does not require GSTIN universally. Omitted input preserves a patch's
stored value; null, empty and whitespace-only input explicitly normalize to NULL. Supplied
values trim and uppercase, then must match the 15-character GSTIN format. Format validation
is not proof of active registration, applicable tax treatment or business identity.

PAN and applicable identity/business checks are preserved. GST_CERTIFICATE is required when
a GSTIN is supplied. Its absence is not a universal submission blocker when no GSTIN is supplied. Before approval,
an authorized reviewer records the actual non-requirement assessment and protected case reference;
blank GSTIN alone is not an exemption. Unresolved applicability stays under review. Existing optional documents are retained, not deleted. A verified business whose
GSTIN changes or is cleared loses the badge and requires a fresh applicability/evidence review
under PR 10's policy. Active profile identifiers remain controlled by the existing admin workflow;
this feature does not add a weaker dealer self-edit path.

Review tax registration liability from actual dealer facts, applicable statutory categories,
turnover, exemptions and current law; do not infer legal non-requirement merely from a blank
field. The [CBIC CGST Act reference](https://cbic-gst.gov.in/pdf/CGST-Act-Updated-31082021.pdf)
distinguishes liable and voluntary registration in sections 22–25. It is a dated consolidated
reference and later amendments/exemptions require current professional review. No universal
threshold or exemption is hard-coded. Optional collection does not remove GST obligations.
PR 10 requires a recorded applicable registration check or a reviewed non-requirement assessment
before awarding a genuine Dealer Verified badge. Unresolved applicability remains in review.

## Database and conflicts

The field already is nullable and uniquely indexed. The additive migration
`20261010153000_optional_gstin` preflights normalized duplicates and invalid legacy values,
reports counts only, and aborts transactionally without changing records on conflict. Valid
legacy lowercase/outer ASCII whitespace values normalize; blank values become NULL. The DB
check accepts only NULL or canonical format, and the existing unique index prevents races.
Unexpected Unicode/ambiguous legacy formatting is a private correction task, not a destructive
automatic guess. PAN, owners, business status, listings and document bytes remain untouched.

Distinct dealerships retain the existing unique tax identity invariant. API prechecks and DB
race errors both return GSTIN_ALREADY_REGISTERED with the GSTIN field error; email conflict
handling remains intact. No raw GSTIN is written to logs or public testing evidence. Existing
public business GSTIN display remains conditional on a supplied value and is not verification
proof. No PAN or private certificate is added to public payloads.

Before rollout, rehearse on a protected representative copy and resolve any preflight conflict
privately. Schema first, compatible writers next; no production migration/reset/seed is executed
by this campaign. No new environment/provider settings. After rollout prefer a forward fix to
preserve private history rather than reinstating a universal collection blocker.

## Owner UAT

1. Register/edit a draft through self, sales and admin paths with no GSTIN, blank or NULL.
   Confirm database NULL and no fabricated identifier. Omitted patches preserve existing values.
2. Complete applicable PAN/address checks and submit without a GST certificate when no GSTIN
   exists. Review approval separately from genuine verification.
3. Supply a valid-format GSTIN, including lowercase/outer whitespace; verify canonical storage
   and the certificate requirement. Invalid supplied values must fail API validation.
4. Try an exact/case-varied duplicate and two concurrent assignments; only one succeeds and
   the other shows a meaningful field conflict. Direct DB writes still enforce the invariant.
5. Change or clear an existing GSTIN through authorized admin editing; preserve the document
   bytes and revoke any existing Dealer Verified badge for a new applicability review.
6. Check mobile/desktop optional labels, errors and conditional public GSTIN display. The
   document review screen must not imply that format alone verifies registration.
