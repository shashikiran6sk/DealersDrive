# PR 8 — Five unanswered ticket replies

- PR: https://github.com/shashikiran6sk/DealersDrive/pull/295
- Branch: `feat/ticket-message-limits`
- Base: `feat/mobile-admin-access` / PR 294, `a17b4a4ea98b084fbf65691d64a9debc10f5901f`
- Final head: `98a5b786f8b7b8903a08c8d2d9bf3f5aa478e1df`
- State: OPEN; MERGED: NO; no production deployment
- Incremental diff: 23 files, three commits, one migration
- Next planned PR: 9, `fix/mobile-sidebar-navigation`

## Implementation and security

Successfully persisted CUSTOMER messages consume one of five per-ticket slots. A new
currently authorized SUPPORT message resets five slots. Original description, internal
notes and status changes do not reset/consume a slot. The actual model has no attachment
or system-message author; forged attachment/author fields fail strict validation.

Customer ownership is checked before replay lookup. Ticket row locks make insertion,
quota update/reset and lifecycle changes atomic. An optional UUID deduplicates retries by
ticket, author type, author identity and identical body. A reused UUID with altered body
is refused. An old admin retry does not reset a subsequently consumed quota. Admin
membership/role/admission is rechecked inside the transaction under the existing membership
lock, including removal, suspension and disabling races. Public customer DTOs have no
admin notes or other private detail.

The additive migration bounds the stored counter to 0–5 and retains every historic message.
Legacy over-limit tickets start blocked; ambiguous equal-time messages conservatively count.
Resolved tickets can reopen without resetting; closed tickets reject new replies. An exact
old retry is acknowledged without reopening. Drain old writers during schema-first rollout;
no production migration/reset/seed was executed.

## Executed validation

These are current executed results, not the historical 556-case certification claim.
Repeated runs are not summed.

| Category             | Executed result                                                                                                                                      | Evidence                                                              |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Formatting/lint/docs | PASS, `pnpm lint`                                                                                                                                    | adminfix-pre-lint.txt                                                 |
| Typecheck            | PASS, `pnpm run typecheck`                                                                                                                           | adminfix-pre-typecheck.txt                                            |
| Unit/integration     | PASS, `TZ=UTC APP_ENV=local pnpm run test --env-mode=loose --force`                                                                                  | adminfix-pre-tests.txt                                                |
| Current suite        | 5,215 passed: API 3,216, web 1,530, contracts 469                                                                                                    | adminfix-pre-tests.txt                                                |
| Coverage             | API branches 90.21%, lines 96.95%; unchanged 90% branch gate                                                                                         | adminfix-pre-tests.txt                                                |
| Quota integration    | 24 actual PostgreSQL/API cases, including concurrent final-slot and replay cases                                                                     | apps/api/tests/ticket-message-limits.test.ts on feature head          |
| Migration            | Four isolated clean/legacy/constraints/rollback cases; Prisma schema valid                                                                           | tests log; prisma.txt                                                 |
| Browser              | PASS, 15 quota workflow checks plus 22 authentication regression checks; customer/authorized admin, two resets, second tab, direct sixth API request | browser-results.json, browser-final-output.txt, browser.sanitized.mjs |
| Responsive           | PASS, 320/390/768/1280px reload and no horizontal overflow                                                                                           | screenshots/blocked-ticket-*.png                                      |
| Production build     | PASS, `pnpm build --force`; no deployment                                                                                                            | adminfix-pre-build.txt                                                |
| Security             | Latest-head CI Semgrep no blocking findings; full-history gitleaks no leaks                                                                          | final-security-log.txt                                                |

The `adminfix-pre-*` filenames identify the local gate before pushing the final fix;
they were executed **after PR 295 was created**, against the exact final fix contents.
The PR itself had pre-creation checks and repeated post-creation checks before these fixes.

Actual browser testing found two defects after PR creation: customer conversation/allowance
stayed behind the persisted reply, and the admin conversation did not show its persisted
support reply. Database inspection confirmed persistence, so these were UI refresh defects.
Same-PR commits `fdee3eac` and `98a5b786` now apply the safe persisted authorized API snapshot
immediately. Older refreshes and other ticket navigation cannot overwrite/carry the saved
conversation. New regression tests exercise these boundaries. The full browser campaign
was repeated successfully after both fixes. A supplemental controlled-provider authentication
campaign passed 22 checks on this final application, including separate cookies, Google/OTP,
customer/dealer/admin logout isolation, recovery and session rotation. The initial immediate
rotation probe was refused within the real cooldown; the script waited the full 60 seconds
and repeated the isolation checks successfully. No application limit was relaxed. See
`auth-regression-results.json` and `auth-regression-output.txt`.

## CI gate

Both [CI](https://github.com/shashikiran6sk/DealersDrive/actions/runs/38059238707) and
[Security](https://github.com/shashikiran6sk/DealersDrive/actions/runs/38059238693)
completed SUCCESS against `98a5b786f8b7b8903a08c8d2d9bf3f5aa478e1df`.
All required jobs and the Vercel preview check pass. The GitHub deployment record is
`Preview`, `production_environment: false`. See exact-SHA JSON records. Existing high
dependency advisories are reported by the configured nonblocking job; no controls changed.

## Owner UAT

1. Create a synthetic customer support request. It starts with five reply slots.
2. Send five separate replies. Each appears immediately; the fifth replaces the composer
   with the exact waiting message and the urgent `/contact` link.
3. Submit a sixth message through the API: expect 409 `SUPPORT_MESSAGE_LIMIT_REACHED`.
4. Reply as an admitted admin with support management permission. The saved reply appears
   in the admin conversation immediately. Reload as customer: five new slots are available.
5. Repeat five replies and a second admin reset. Another ticket has its own allowance.
6. Internal notes, resolving/reopening, and replaying an old admin UUID do not reset slots.
7. Use a stable UUID for the same intended reply across network retries; test the final slot
   concurrently. Exactly one new distinct message can consume the remaining slot.
8. Verify 320/390px, tablet and desktop. Escape/navigation and other admin/customer sessions
   retain their existing behavior. Contact escalation never resets a ticket.

## Limits and rollout

No live MSG91 SMS, real Google provider, native Safari or physical-device certification is
claimed. External provider adapters are controlled; API, server actions, browser and local
PostgreSQL persistence are real. Fixtures are synthetic. Screenshots mask contact values.
Production build logs include optional API-fetch fallback warnings with the API stopped;
the production build exits successfully, and actual runtime pages were tested afterwards.
Existing nonblocking dependency/security advisories remain; this is not a production GO.
Drain old writers, apply the additive migration, then deploy compatible writers only after
owner review and merge. Evidence publication does not merge a feature PR.
