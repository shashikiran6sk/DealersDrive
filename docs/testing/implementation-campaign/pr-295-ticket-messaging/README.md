# #295 — ticket message quota and resolved/closed messaging · independent review

PR: [#295](https://github.com/shashikiran6sk/DealersDrive/pull/295) · branch
`feat/ticket-message-limits` · base `main`. Original author evidence:
[`../pr-08-ticket-limits`](../pr-08-ticket-limits).

| SHA                  | Value                                              |
| -------------------- | -------------------------------------------------- |
| `main` at review     | `210dfc9` (#294 squash)                            |
| Original PR head     | `98a5b78` (parent in stack `a17b4a4`)              |
| Reconciled           | `9ba18c0` — merge commit, byte-identical increment |
| Final validated head | `40fdabe`                                          |

## Quota (as delivered by the branch) — sound

`support_tickets.unansweredCustomerMessages` (CHECK 0–5) incremented with the
customer message under the ticket row lock; reset only by a persisted,
re-authorized support reply; internal notes and status changes never reset it;
idempotent retries via `clientMessageId` (unique per ticket+author type);
migration backfills the counter from history.

## Owner-reported defect — fixed (`40fdabe`)

Customers could keep messaging a resolved ticket. **Baseline defect on `main`**:
`statusAfterCustomerReply(RESOLVED) = OPEN`, so a message silently reopened the
ticket. CLOSED was already refused server-side. Fixed in this PR (owning scope):

| Status                                    | Customer messaging                                                 |
| ----------------------------------------- | ------------------------------------------------------------------ |
| OPEN / IN_PROGRESS / WAITING_FOR_CUSTOMER | Allowed within the quota                                           |
| RESOLVED                                  | 409 `SUPPORT_TICKET_RESOLVED` until explicitly reopened            |
| CLOSED                                    | 409 `SUPPORT_TICKET_CLOSED`; final; customer creates a new request |

`POST /v1/support/tickets/:id/reopen`: own RESOLVED ticket only, under the ticket
row lock; OPEN, `resolvedAt` cleared, audited `support_ticket.reopened`
(cause `customer_reopen`); history and allowance preserved (no quota reset);
idempotent for already-open tickets (concurrent reopens audit once); CLOSED
refused; another customer's ticket 404; rate-limited; OpenAPI documented.
Support may still reply to a resolved ticket. Resolved email copy now says
"choose Reopen". Customer UI: resolved = read-only + Reopen; closed = read-only

- "Create a new request".

Eligibility policy chosen: "RESOLVED, never CLOSED". A time window on reopening
would be a product decision.

## Other findings

| Sev    | Finding                                                                  | Resolution                       |
| ------ | ------------------------------------------------------------------------ | -------------------------------- |
| P3     | Inline "Contact support for urgent help" JSX string (§4b).               | Moved to constants.              |
| P3     | Design note carried PR numbering / DO-NOT-MERGE.                         | Rewritten with the status table. |
| → #297 | Footer: "Dealers-Drive verifies dealer identity and business documents." | Public-claim review in #297.     |

## Executed checks (`40fdabe`)

| Check                                 | Result                                                                                                                                                                                                                          |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| lint + typecheck                      | PASS                                                                                                                                                                                                                            |
| tests                                 | contracts 470 · web 1,537 · API 3,242                                                                                                                                                                                           |
| build                                 | PASS                                                                                                                                                                                                                            |
| E2E (real stack, API + browser 390px) | `e2e-results.json`: 5 accepted, 6th refused; resolved = read-only + Reopen, forged message refused; reopen keeps 5 messages and allowance 0; support reply restores 5; closed = read-only + new request, reopen/message refused |

## CI on `40fdabe`

| Check                           | Result  | Run                                                                                      |
| ------------------------------- | ------- | ---------------------------------------------------------------------------------------- |
| Vercel Preview Comments         | success | https://github.com/shashikiran6sk/DealersDrive/runs/114596111590                         |
| semgrep                         | success | https://github.com/shashikiran6sk/DealersDrive/actions/runs/38181849973/job/114595898325 |
| gitleaks                        | success | https://github.com/shashikiran6sk/DealersDrive/actions/runs/38181849973/job/114595898235 |
| terraform fmt / validate        | success | https://github.com/shashikiran6sk/DealersDrive/actions/runs/38181849949/job/114595898175 |
| lint · typecheck · test · build | success | https://github.com/shashikiran6sk/DealersDrive/actions/runs/38181849949/job/114595898116 |
| dependency audit                | success | https://github.com/shashikiran6sk/DealersDrive/actions/runs/38181849949/job/114595898045 |
| Vercel                          | success | https://vercel.com/dealers-drive/dealersdrive-prod-web/C2AEvA1PK6XEw9vX7PmSXQAFsTCz      |
