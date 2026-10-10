# BUG-001 reproduction and design checkpoint

Bug: invitation acceptance versus owner withdrawal returns an unhandled database conflict.

Baseline additional test: ADD-RACE-001 (FAIL at d6ae115359c4d0ae7ab0fd5115336291666cbb08). Related canonical cases: MEMBER-007 (correct dealership), MEMBER-008 (unique membership), MEMBER-010 (expiry), MEMBER-011 (revoked invitation), MEMBER-012 (different authenticated person), MEMBER-013 (replay), CONCURRENCY-010 (simultaneous accepts), ABUSE-008 (OWNER role manipulation). These associated rows retain their own original classifications; none is relabeled as the baseline failing race.

Current source: branded 404 integration 107a46259f1e8ee13765e3a3559fe5b5bbc88c99; invitation source unchanged at reproduction time.

Environment: isolated local Linux, Node 24.19.0, pnpm 9.15.9, PostgreSQL 16.14. Real HTTP router, database, cookie sessions and guards; inert fake Google/OTP and recording mailer. No production account/provider.

## Phase A

Original baseline reproduction: YES; acceptance 200, losing withdrawal 500, write conflict/deadlock. The unchanged invitation code passed the timing-dependent scenario in the full 404 integration suite. That pass does not disprove or close the earlier failure.

Deterministic reproduction: YES, before implementation. The withdrawal-first regression returned acceptance HTTP 500 and withdrawal 204; PostgreSQL reported 40P01 (deadlock detected). The acceptance-first control passed. The adjacent suspension regression returned 200 instead of 409. The original timing-dependent test passed in that same run; both new regressions failed. The sanitized `bug001-red` log preserves all results. Draft test queues withdrawal before acceptance while a separate connection holds the dealer row FOR UPDATE, observes both requests waiting via pg_stat_activity, then releases the dealer lock. The inverse queue order is also tested. Expected: withdrawal-first 204/409 and no membership; acceptance-first 200/404 and exactly one active membership. Persisted timestamps, actors, audit records and continued customer authentication are inspected.

## Root cause before code

Entry points: POST /v1/invitations/:id/accept and DELETE /v1/dealer/team/invitations/:id. The customer route requires the proven phone identity; the owner route requires member:manage. Both validate UUIDs before reaching services.

Acceptance: InvitationsService.accept → lockOwnPending locks invitation by id AND verified phone → reads invitation/dealer → lockDealership → creates/reactivates membership, marks ACCEPTED, ensures DEALER seat, writes member.joined audit.

Withdrawal: TeamService.revokeInvitation → lockDealership → reads own PENDING invitation → updates it (acquires invitation lock) → writes member.invitation_revoked audit.

The inverse lock order creates a cycle: acceptance holds invitation and waits on dealer; withdrawal holds dealer and waits on invitation. PostgreSQL aborts a transaction. No domain response maps this write conflict, so the loser can return 500. The remedy is consistent lock order, not retrying or masking database errors.

Dealer status is also read before acceptance acquires the dealer lock. A related adversarial regression will verify that suspension committed while acceptance waits is observed before membership creation.

## Smallest proposed fix

Before acceptance locks the invitation, read only dealerId from an invitation scoped to id and the customer's proven phone. Missing/foreign ids retain the same 404. Lock that dealer first. Then call the existing invitation-lock helper, which rechecks phone, status, expiry and reads fresh dealer state under the lock. Remove the later redundant dealer lock. Withdrawal already follows this order. Decline does not acquire a dealer lock or a dealer foreign-key lock during audit, so it cannot form this two-resource cycle and needs no behavior change.

No schema, API contract, role matrix, UI, history or transaction retry rewrite is required. Membership uniqueness, seat creation and audit atomicity remain in the same transaction. Review adjacent invite renewal, accept replay, two accepts, expiry, decline, suspension, removed-member re-invitation, phone identity and cross-dealer access through existing integration suites plus controlled regressions.

Stack: #209 claude/serene-thompson-yuft81 → main. BUG-001 branch `fix/pre-production-01-invitation-race` created from #209 head `107a462`; PR not created yet. #209 CI run 358 and Security run 507 both PASS at that exact SHA. Required supporting workflow change for BUG-001: CI and Security currently filter PR bases to main, so stacked PRs would not run them. Permit all pull-request bases while preserving push/schedule behavior and existing job permissions.

## BUG-NEW-002 — Acceptance reads stale dealership status before a lock wait

Severity: P2. Reproduced: YES in the same isolated source/environment above. Hold the dealer row, start acceptance, observe it waiting, update status to SUSPENDED on the holder connection and commit, then inspect the acceptance response. Expected: 409 DEALERSHIP_NOT_ACCEPTING and no membership; actual: 200. The resulting customer cannot enter a suspended dealership, but an acceptance that should be refused still creates membership. Root cause: dealer.status was fetched in lockOwnPending before the dealer row lock was acquired.

This is directly coupled to BUG-001's lock order. The required architectural correction moves that lock ahead of the existing scoped invitation/dealer read, so fresh dealer status is checked by construction. No additional status rule, UI change or unrelated rewrite is added for this finding. It has a separate regression and retest attribution within the same lock-order layer.
