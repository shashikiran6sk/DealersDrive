# Combined PR 1–11 regression

Final branch `feat/optional-gstin`, SHA `b500bd5ae6bd026f8f0e9b0d7b3a6cd5fc7c531e`.
All eleven feature PRs are open/unmerged with passing required checks on their respective final
heads. This is a separate complete application regression after individual post-creation testing.
No production deployment or database operation occurred.

Full `pnpm lint`, forced `pnpm run typecheck --force`,
`TZ=UTC APP_ENV=local pnpm run test --env-mode=loose --force` and `pnpm build --force` passed.
5,289 current tests: API 3,268, web 1,537, contracts 484. API branches 90.53%, lines 97.02%,
unchanged 90% threshold. Migration rehearsals and real PostgreSQL/API authentication,
authorization, onboarding, listings, public search, support, privacy and security cases are
part of the complete executed suite. Do not substitute the historical 556-case report for this.

93 actual browser checks passed on this combined application: 22 admin Google/OTP enrollment,
recovery, refresh, session rotation and customer/dealer/admin isolation; 15 ticket quota/reset/
reload/API enforcement; 26 responsive navigation/focus/backdrop/scroll/account/admin entry;
17 genuine dealer verification/no-yard/rejection/revocation/cache/history/directory; 13 optional
GSTIN/dealer OTP/profile/admin update/clearing/errors/public cache/draft onboarding.
Representative 320/390/768/1280px layouts and small-phone variants were exercised. The real OTP
cooldown was respected. A hidden transition textbox confused an initial browser label selector;
visible accessible roles were selected and the ticket/navigation campaign repeated successfully.
No application workaround or weaker quota/rate limit was introduced.

The verification fixture setup encountered an already-existing synthetic legacy business name.
The controlled fixture was reused instead of resetting data; actual verification UAT then passed.
Failed setup logs containing test identifiers are not published. All records/documents are
synthetic, providers controlled at their external boundary, but application/API/cookies/SQL/
storage/browser paths are real. Individual evidence folders contain sanitized actual screenshots.

[Final CI](https://github.com/shashikiran6sk/DealersDrive/actions/runs/38081826917) and
[Security](https://github.com/shashikiran6sk/DealersDrive/actions/runs/38081826913) succeeded on
this SHA. Required check rollup and preview/non-production metadata are in PR 11 evidence.
No secrets scan/control/coverage gate was disabled. Existing nonblocking dependency and
security advisories remain, and live provider compatibility/legal applicability/native-device
owner UAT are still rollout requirements. This report does not assert production GO.

No current evidence supports saying all historical 556 manual cases were executed/passed.
The independent progressive onboarding Draft will be built directly from latest main, with no
unmerged stack ancestry. Product/legal review and eventual owner-controlled merge/deployment
remain necessary. See individual feature reports for migrations and exact owner UAT steps.
