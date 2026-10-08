# PR #280 — white-label foundation evidence

PR: https://github.com/shashikiran6sk/DealersDrive/pull/280

Head: `7a41bc7e40810dee68e72c1ff4e76e97861b750b`.
Parent main: `2a1845abcab9a6cf8b9fc3658cb5c92bf3c92566`.
Evidence branch: `testing_branch`, based on the existing `testing_evidence`
conventions. These artifacts are deliberately absent from the feature PR.

Executed local gates:

- Frozen-lockfile install, Prisma generation and schema validation: pass.
- `pnpm lint`, including format and documentation references: pass.
- `pnpm typecheck`: pass, including the existing sandbox.
- `pnpm test`: pass. API 3,026 tests / 153 files; contracts 511 / 16;
  web 1,472 / 121. Includes 9 foundation invariant tests, 3 migration
  preservation tests and 84 new contract/permission cases.
- API coverage: statements 95.94%, branches 90.35%, functions 97.90%,
  lines 96.99%. Contracts: branches 95.11%, functions 97.11%, lines 98.80%.
  Both pass the unchanged 90% gates.
- `pnpm build`: pass. Existing remote font assets required network access.
- `pnpm audit --audit-level=critical`: pass; reports 6 high and 6 moderate
  advisories. No dependencies were added or versions changed.
- `git diff --check`: pass.
- Terraform formatting: pass. Local validate could not run because the AWS
  provider is not installed; the unchanged GitHub terraform job verifies it.

The migration rehearsal creates only `dealersdrive_migration_storefront`,
replays the preceding migrations, inserts synthetic pre-feature inventory
and enquiries, applies the additive migration and checks preservation. The
standard integration setup uses only `dealersdrive_test`.

Failures resolved before the final run: contract phone normalization, OpenAPI
input registration, and local timezone-dependent migration expectations.
An overlapping focused DB test run conflicted with global setup; its affected
results were discarded and the final full suite ran serially. No tests were
disabled and no coverage/type/lint gates were lowered.

No UI/screenshots apply. No production migrations, provider calls, DNS changes,
merges or production deployments were performed. GitHub final-head results
are verified successful on the final head: lint/typecheck/test/build, dependency
audit, Gitleaks and Semgrep, plus Terraform validation and Vercel preview. CI run
37777766736 and Security run 37777766703 completed successfully. PR #280 is OPEN,
unmerged and has no auto-merge request. Full logs and final GitHub JSON are beside
this file.
