# Optional dealer tagline — campaign PR 5

Tagline is optional for self-registration, Sales-assisted registration, admin edits, and
dealer profile changes. Omitted values are accepted; null, empty, and whitespace-only
values normalize to null. Nonempty text is trimmed and limited to 200 characters. An
omitted patch keeps the existing value. Existing stored taglines are not rewritten.

The shared `DealerTaglineInput` applies the same policy to all request contracts. Public
payloads omit blank historical text through nullable values; the detail page already hides
an absent tagline without an empty paragraph. No fallback marketing sentence is stored or
shown as a dealer's own words. React text rendering continues to escape supplied content.

## Moderation and migration

Active dealers still submit marketing changes for review. Clearing a live tagline is a
real proposal, not an instruction to bypass review. `DealerProfileChange.taglineChanged`
distinguishes a removal (`true` plus null) from a services-only edit (`false` plus null).
The dealer and reviewer see explicit removal intent. Approval publishes the change;
refusal/withdrawal leaves live text intact. Approval/refusal lock the dealer and proposal,
recheck pending state, and save publication, decision, audit and outbox atomically.
Withdrawal also rechecks the pending proposal under the same parent lock.

Apply `20261010093000_optional_tagline` before the API rollout. It adds a non-null boolean
with a false default and marks historical non-null proposals as replacements. Dealer
strings, proposal contents, statuses, identity, documents, and memberships are preserved.
New readers also recognize non-null legacy proposals written during a mixed-version
window. Drain old review workers before enabling removal proposals: an old reviewer does
not understand null-as-removal. Prefer a forward fix after new removal requests exist;
never drop the flag while pending null-removal proposals depend on it. No production
migration is executed by this campaign.

## Owner UAT

1. Register a dealer without a tagline through self and assisted flows. Keep other identity,
   location, document and approval requirements. Confirm the database value is null.
2. Try whitespace, null, a short value, 200 characters, and 201 characters through the API.
   Valid absence/text is accepted; overlong and non-text values are rejected.
3. Edit a draft or use an authorized admin to clear a tagline. Verify blank public rendering
   and preservation of unrelated profile data.
4. As an active dealer, request removal. The old tagline remains public while pending.
   Approve it and confirm it disappears; refuse/withdraw and confirm it remains.
5. Make a services-only change with omitted tagline and verify the existing line is retained.
   Attempt a forged approval using a dealer cookie and confirm rejection.
6. Review phone/desktop forms and the removal comparison. No public “No tagline provided”
   placeholder or marketing text should appear when no tagline exists.

## Post-creation CI infrastructure correction

GitHub's original run and retry stopped before tests/scans when unauthenticated Docker Hub
pulls were rate-limited. The same PR therefore corrects the required test infrastructure:
PostgreSQL 16 Alpine uses its digest-pinned Docker Official Image on Amazon ECR Public;
Gitleaks uses its publisher's digest-pinned GHCR image, whose digest matches the preceding
successful Docker Hub run; Semgrep 1.179.0, matching that successful container release,
is installed from its official Python distribution. All seven rule packs, severity gates,
full-history secret scanning, redaction, check names and read-only job permissions remain.
Scanner execution errors now fail the job explicitly. No branch protection changed.

Distribution references: [Docker Official Images on ECR Public](https://aws.amazon.com/blogs/containers/docker-official-images-now-available-on-amazon-elastic-container-registry-public/),
[Gitleaks official distributions](https://github.com/gitleaks/gitleaks),
[Semgrep installation](https://github.com/semgrep/semgrep).
