# #288 — dealer primary email uniqueness · independent review

PR: [#288](https://github.com/shashikiran6sk/DealersDrive/pull/288) ·
branch `fix/dealer-email-uniqueness` · base `main` (auto-retargeted when #287
merged). Original author evidence: [`../pr-02-email-uniqueness`](../pr-02-email-uniqueness).

| SHA                  | Value                                                                    |
| -------------------- | ------------------------------------------------------------------------ |
| `main` at review     | `5d5b5e6` (#287 squash)                                                  |
| Original PR head     | `9ad0c9e` (stacked on the pre-correction #287 head `6bc0128`)            |
| Reconciled           | `75cab45` (merge of `main`) + `4f2fb1d` (strip scaffolding #287 removed) |
| Final validated head | `5b6be13`                                                                |

## Reconciliation

`main` merged in with no conflicts. Because this branch descended from
`6bc0128`, not from #287's corrected head, the merge kept the stacked-branch
CI/Security triggers, `AGENTS.md` and `docs/project/implementation-campaign.md`
that #287 had removed. `4f2fb1d` removed them again. After that,
`diff(6bc0128..9ad0c9e) == diff(origin/main..4f2fb1d)` **byte for byte**: the
reconciled PR is exactly the original #288 increment, nothing lost or added.

Every later stacked branch descends from `6bc0128` too and needs the same strip.

## Review

Scope: a private, database-maintained `dealers.primaryOwnerEmail` (unique),
one-active-owner partial index, email canonicalisation triggers, and the
service changes so assisted create/edit, self-registration, claims and account
merge answer a collision with 409 `DEALER_EMAIL_TAKEN`.

What holds up:

- **Fail-closed migration.** Three pre-checks abort the whole transaction with
  group counts only (no PII) on duplicate canonical user emails, multiple active
  owners, or colliding derived primary emails. Additive; no row deleted, merged
  or re-owned. Rehearsed by `dealer-email-migration.test.ts` (clean + legacy data,
  ambiguous duplicates, rollback, retry).
- **Database is the authority.** Forged writes to `primaryOwnerEmail` are
  overwritten by the BEFORE trigger; the unique index settles concurrent
  registration (tested: one 201, one 409).
- **Typed email never grants ownership.** Representative-entered email is a
  reservation only; ownership still needs the email link + phone OTP claim.
- **Sign-in never locks a person out.** A Google subject whose changed email
  collides keeps its old identity email and gets an audited
  `auth.identity.email_update_blocked`; sign-in still succeeds.
- **Owner identity email is no longer editable** through the generic profile
  update (previously `contact.email` silently rewrote `users.email` — an
  identity change without proof). Now `OWNER_EMAIL_PROOF_REQUIRED`.
- Assisted draft edits lock the dealer row and recheck editability in the same
  transaction; the email-verification race is covered by a lock-wait test.
- No enumeration beyond authenticated sales reps; logs carry field names, not
  addresses; the field is absent from public DTOs.

### Findings

| Sev          | Finding                                                                                                                                                                                                                                                                                                                                                                  | Resolution                                                                                                                               |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| P2           | **Claim returned 500 on a primary-email collision.** Claiming upserts an OWNER membership; the trigger derives `primaryOwnerEmail` from the claimant's verified Google email; if another unclaimed assisted application reserves that address the unique index fires and the raw P2002 escaped (no global P2002 mapping). Reproduced by a new integration test: **500**. | Fixed in `209836d`: claim transaction wrapped in `withDealerEmailConflict` → 409 `DEALER_EMAIL_TAKEN`, nothing written. Test now passes. |
| P3           | `docs/project/dealer-email-uniqueness.md` ended with campaign status ("must remain open and unmerged", stacked base).                                                                                                                                                                                                                                                    | Removed in `5b6be13`.                                                                                                                    |
| P3           | Google _linking_ on a collision answers 409 `IDENTITY_ALREADY_LINKED` ("belongs to another account") — correct status, misleading text.                                                                                                                                                                                                                                  | Not changed; noted.                                                                                                                      |
| P3           | Assisted edit resolves a changed Maps URL (≤2.5 s/hop) while holding the dealer row lock (tx timeout 20 s).                                                                                                                                                                                                                                                              | Not changed; bounded.                                                                                                                    |
| P3 / product | A REJECTED or CLOSED assisted application keeps its email reserved (deliberate, tested for all six statuses). Recovery: an admin edits that unowned application's contact email.                                                                                                                                                                                         | Owner decision; documented.                                                                                                              |
| P3           | Admin editing an owned dealership's contact email gets "Contact support to change it" — the admin _is_ support; no controlled identity-change tool exists yet.                                                                                                                                                                                                           | Noted for a follow-up.                                                                                                                   |

No P0 or P1 findings.

## Executed checks on `209836d` / `5b6be13` (Node 24.21.0, PostgreSQL 16.15)

| Check                                           | Result                                                                                                                                          |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm lint` + `pnpm typecheck`                  | PASS on `5b6be13`                                                                                                                               |
| `pnpm test` contracts                           | 428 / 428                                                                                                                                       |
| `pnpm test` web                                 | 1,489 / 1,489                                                                                                                                   |
| `pnpm test` API (real Postgres, all migrations) | 3,060 / 3,060 — includes dealer-claims 16, sales-assisted-onboarding 31, identity-linking 19, dealer-email-migration 5, dealer-email-identity 8 |
| `pnpm build`                                    | PASS on `5b6be13`                                                                                                                               |
| Claim collision regression                      | 500 before fix → 409 after                                                                                                                      |
| `production-duplicate-inventory.sql`            | Runs read-only on a migrated schema; counts only                                                                                                |

`5b6be13` differs from `209836d` only by a Markdown paragraph; tests were run
on `209836d`, lint/typecheck/build on `5b6be13`.

Environment note: two local runs were invalidated by the container
interrupting PostgreSQL and re-running a background job; both were discarded
and the suite re-run cleanly. Not a product defect.

## Rollout

1. **Before promoting the API**, run `production-duplicate-inventory.sql`
   read-only. All three counts must be 0, or the migrator task fails (safely,
   changing nothing) and the API rollout stops.
2. `promote.yml` runs migrations before the API rollout — required, because the
   new API code reads the column.
3. The web change (sales form keeps values across re-verification) is
   compatible with the old API.
4. Rollback: keep the column/indexes (stronger invariant, old code ignores
   them); revert application code only. No destructive down-migration.

Deployment observation: the #287 merge (`5d5b5e6`) produced **no** Vercel
deployment and no Vercel status — consistent with production web deploys
being manual. Not confirmed from Vercel settings.

## CI on final head

See `ci.md`.
