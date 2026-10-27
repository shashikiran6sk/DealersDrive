# Optional GSTIN

General onboarding does not require GSTIN universally. Omitted input preserves a patch's
stored value; null, empty and whitespace-only input explicitly normalize to NULL. Supplied
values trim and uppercase, then must match the 15-character GSTIN format. Format validation
is not proof of active registration, applicable tax treatment or business identity.

## Owner decision, 2026-10-12: the GSTIN lives on the GST certificate

Dealers and sales representatives no longer type a GSTIN or a PAN in separate fields.

- **GSTIN.** Entered only in an optional box on the Business Identity Proof card, shown when the
  dealer picks "GST certificate". Committing that document sets the GSTIN on file from the box
  (blank: none); committing any other business proof clears it, so the GSTIN on file is always
  the one on the certificate under review. A GSTIN with any other document is refused
  (`GSTIN_NEEDS_GST_CERTIFICATE`). A change revokes Dealer Verified, as any change to business
  identity does. The admin profile editor can still correct it.
- **PAN.** Not collected as a number. A PAN card is one of the Personal Identity Proof choices,
  which is where identity is reviewed. Existing PAN values are kept; the admin editor can still
  change them.
- **No GST note at approval.** Approval and manual activation no longer ask the reviewer to write
  why GST registration is not required. Instead the onboarding text (and, for assisted
  onboarding, the consent the dealer gives) states that the dealership is responsible for its own
  GST registration where the law requires one.

What did not change: format validation, normalisation, uniqueness and the database constraint
below; with a GSTIN on file the business proof must be the GST certificate; a blank GSTIN is
still not proof that GST registration is not required — it simply is no longer something the
platform asks a reviewer to assert.

Review tax registration liability from actual dealer facts, applicable statutory categories,
turnover, exemptions and current law. The [CBIC CGST Act reference](https://cbic-gst.gov.in/pdf/CGST-Act-Updated-31082021.pdf)
distinguishes liable and voluntary registration in sections 22–25. It is a dated consolidated
reference and later amendments/exemptions require current professional review. No universal
threshold or exemption is hard-coded. **Legal review item:** whether the responsibility line is
sufficient in place of a recorded applicability review.

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
privately. Schema first, compatible writers next. No new environment/provider settings. After rollout prefer a forward fix to
preserve private history rather than reinstating a universal collection blocker.

## Owner UAT

1. Register a dealership as a dealer and as a sales representative: no GSTIN or PAN field on any
   form. Upload a Udyam certificate as the business proof and submit; the GSTIN stays empty.
2. Choose "GST certificate" as the business proof: a GSTIN box appears. Enter a lowercase GSTIN
   with spaces; confirm it is stored uppercase. Enter an invalid one; confirm the field error.
3. Replace the GST certificate with a Shop & Establishment certificate; confirm the GSTIN is
   cleared. Enter a GSTIN another dealership holds; confirm the field conflict.
4. Approve and manually activate a dealership without a GSTIN: no GST note is asked for.
5. On a Dealer Verified dealership, change the GSTIN through a new GST certificate; the badge is
   revoked for a new review.
6. Check the assisted consent text and the dealer documents step carry the GST responsibility line.
