# Primary dealer email identity

## Invariant and verified ownership

One canonical primary owner email identifies one dealership/application. A
MANAGER/STAFF email does not reserve ownership, and staff may retain memberships
in multiple dealerships. Existing customer or operator accounts with no dealer
ownership are not rejected merely because their email exists. A representative's
typed email remains an unverified declaration: it neither creates/merges a user
nor assigns an OWNER membership. The existing email-link and mobile-proof claim
flow remains authoritative. Existing onboarding and claiming already refuse
additional active dealership ownership; this change enforces that boundary in
the database without prohibiting staff relationships.

`dealers.primaryOwnerEmail` is private, database-maintained metadata. For an
active OWNER it follows the first verified Google identity used by the existing
identity resolver, falling back to their existing account/declaration while
identity completion is pending. An unclaimed dealership reserves its declared
contact email. Public contact details remain separate. DTO mappers do not expose
the derived field. No uploaded document, yard photo, approval or verification
status influences this identity constraint.

Email normalization trims outer whitespace and lowercases. It preserves dots,
plus addressing and the mailbox/domain content. Database triggers normalize
user/OAuth/contact emails and maintain derived ownership on membership, account
and verified identity changes. A unique index makes concurrent registration
safe independently of frontend checks; one active OWNER per dealership is also
enforced. Conflicting PRIMARY ownership must not be collapsed through account
merging. Ordinary customer/dealer linking and multi-dealership staff behavior
are covered by regression tests.

## API and user feedback

Authenticated representative create/update and dealer self-registration return
409 `DEALER_EMAIL_TAKEN` with useful field feedback. They disclose no existing
dealer, owner or contact details. Ordinary pre-existing conflicts are checked
before consuming a valid assisted phone ticket, permitting email correction.
The database still resolves races. Expired/consumed verification can be renewed
without losing entered form fields. Owner account email cannot be reassigned by
generic profile edits; such a change requires a controlled verified identity
procedure/support. Existing verified Google and OTP linking is preserved.

Assisted draft edits lock the dealership and recheck assistance/ownership in
the transaction. Contact changes, verification invalidation, fresh email-link
request and audit commit atomically. A rejected conflict rolls back all of them.
Duplicate rejection logging contains an event and field name, not raw email.

If an existing Google subject proves a changed email that conflicts with another
application, authentication still resolves the same existing person. The prior
identity metadata is preserved and a restricted audit records the blocked email
update for ownership review; neither dealership is reassigned or merged. A
verified account link that would collapse conflicting primary ownership is
refused with a meaningful conflict and complete transaction rollback.

## Migration and existing-data plan

Migration `20261009160000_dealer_primary_email` is additive and transactional.
Before normalization or enforcement, it refuses:

- multiple user rows with the same canonical email;
- multiple active owners of one dealership;
- multiple dealerships whose derived primary owner identity conflicts.

Errors contain group counts rather than personal identifiers. The entire
transaction rolls back; no duplicate is selected, deleted, merged, suspended,
re-owned or silently corrected. Existing dealership, user, membership, listing
and document IDs remain unchanged. Canonical casing/whitespace is normalized;
email semantics and valid existing public contacts are preserved.

Before production rollout, an authorized operator must execute a read-only
duplicate inventory in a restricted environment. Do not publish addresses,
identity documents or account identifiers as campaign evidence. Review conflicting
declarations against actual verified ownership; legitimate staff relationships
are excluded. If an existing relationship demonstrates a business exception,
resolve that policy explicitly before applying the constraint. Rehearse the
reviewed correction on an isolated restore and retry the migration. This
campaign performs no production audit query, data correction or migration.

The executed read-only local inventory covered 126 development dealer rows:
zero canonical user conflict groups, zero multiple-active-owner groups, and
zero primary dealer email conflict groups. This is development evidence and
does not certify production data.

The migration locks the four relevant identity tables and creates ordinary
unique indexes inside its transaction. Schedule the migration according to
production table size/write load; rehearse lock duration and index creation on
a restore. New code requires the column, so migrate before activating the new
application version. Old serializers remain compatible with the additive
column. Rollback application code may retain the stronger database invariant;
use a reviewed forward fix instead of dropping protections or destroying data.

Indexes support canonical email lookups and ownership membership. Public reads
gain no query. Derivation runs only on email/membership changes, not unrelated
dealer counters. No provider credentials or new environment variables are added.

## Validation and owner UAT

The executable coverage includes canonical case/whitespace, all six dealer
statuses, direct forged database field writes, concurrent registration, edit
rollback, staff membership, existing non-owner operator identity and refused
self-registration against an assisted reservation. Migration rehearsals cover
clean installation, representative existing identity/listing preservation,
ambiguous duplicates, complete transaction rollback and reviewed forward retry.
Frontend recovery tests preserve entered values through renewed mobile proof.

Owner UAT: sign in as a representative in an isolated environment, verify a
disposable mobile, and enter an existing owner's email using different casing
and surrounding whitespace. Confirm the field error; correct it and create
successfully. Repeat an assisted draft edit using another dealer's email and
confirm its previous verification remains unchanged. Use the renewed mobile
verification control after expiry and check that form values remain. Verify
that staff can still access their authorized dealerships and cannot claim
ownership by submitting an email.

Base: `feat/dd-favicon-sizing` (#287), validated final head `6bc01285`.
No unmerged white-label or legal changes are inherited. PR must remain open and
unmerged, and its final-head CI plus post-creation tests must pass before PR 3.
