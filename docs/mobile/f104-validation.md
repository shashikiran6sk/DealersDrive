# F104 saved cars and account — validation checkpoint

Immediate base: F103 feat/f103-mobile-home-dealers at b4357a32c49b3ac0285cd9b1521672ab48fff527 / draft PR #316. Its reported GitHub checks pass. PR #279 remains OPEN at 6180a4b52522493b884550448d0a84e7d95432df; main remains a969dc2. No protected branch was changed.

Native server-backed save/unsave/list, complete saved-state hydration and account Agreements/history are implemented. The existing slug API gains optional strict cursor pagination with unchanged query-less response. The lean legal-client export preserves old contract exports. No database migration, identity split, policy publication, new dependency or website UI change.

Local native evidence: 13 suites / 64 tests PASS, typecheck/lint/boundaries and approved asset verification PASS. New cases cover hydration beyond 500, deduplication, cursor loops, cancellation, positive pending Save consumption once, repeated-tap locking and ignoring an expired response from another account. Shared contracts: 28 files / 596 tests PASS; coverage branches 92.02%. Existing website: 144 files / 1,727 tests PASS.

Backend: 179 files / 3,500 tests PASS; coverage statements 95.70%, branches 90.30%, functions 97.93%, lines 96.95%, all existing 90% gates pass. A subsequent focused saved suite with the added cookie/bearer synchronization and foreign-account case passes 21 tests. Root lint/typecheck/build PASS, including API/web compilation and Android Hermes export. Mobile final rerun passes 64 tests. Integration cases exercise real local test-database ownership, keyset pages, strict controls and exact legacy response; external providers remain fake. Existing pg query deprecation warnings and sandbox-blocked web prerender fetch diagnostics were observed; builds completed successfully. Native APK/AAB compilation and manual Swagger browser inspection remain unavailable in this checkpoint.

Installed Android keyboard/back/insets/TalkBack/lifecycle, live provider identity, real-device cross-platform saves and screenshots remain unavailable locally. No native-device validation or production readiness is claimed. Native release, approved legal publication and manual external verification remain separate gates.

Rollback: reject or revert the unmerged incremental native/API change through normal commits. Legacy consumers do not depend on the optional page descriptor; no data migration requires reversal. Preserve the stack and no shared-history rewrite, merge, production deployment or publication.

See [implementation details](../code/mobile/saved-account.md).
