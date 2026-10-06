# PR #270 — Admin Members & least-privilege RBAC (R110)

- `rbac-integration-tests.txt` — verbose run of `tests/admin-member-rbac.test.ts`.
- `full-api-suite.txt` — the full API suite summary and coverage.

## Sales Representative vs the admin console

The suite reads every `/v1/admin` operation out of the generated OpenAPI
document (which `openapi.test.ts` already proves equals the mounted routes),
substitutes random UUIDs for path parameters, and calls each one with a Sales
Representative's real session cookie. Every one answers
`403 ADMIN_CONSOLE_FORBIDDEN` — before validation, before any lookup — so the
answer cannot leak whether an id exists.

## Backfill check

Run against a scratch database migrated to the previous head and seeded with
legacy operators, then migrated forward:

| email | role | status | source |
| --- | --- | --- | --- |
| boot@x.in (no granter) | SUPER_ADMIN | ACTIVE | BOOTSTRAP |
| granted.used@x.in | MODERATOR | ACTIVE | INVITED |
| granted.unused@x.in | SUPPORT | INVITED | INVITED |
| suspended@x.in | MODERATOR | DISABLED | INVITED |
| dealer@x.in (not an operator) | — | — | — |
