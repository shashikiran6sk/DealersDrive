# Five unanswered ticket messages

PR 8 limits each ticket to five successfully persisted customer messages after its latest
authorized support reply. The original request description is a separate field, not a message
record; registration starts with five reply slots. The actual author enum is CUSTOMER/SUPPORT.
There are no attachment or system-message records in this version; strict contracts reject
attachment-only and forged-author submissions. Internal notes are stored separately and never
reset the quota. Status changes, reopening, failed submissions and other tickets do not reset it.

Both reply writers lock the same ticket row. A customer insertion and counter increment commit
together; the sixth insertion is rejected independently of frontend controls. A genuine authorized
support insertion resets the counter in that transaction. Support admission is rechecked under
the member-management lock, so disabling or permission removal cannot turn a stale principal into
a qualifying reply. Database constraints bound the counter to zero through five.

The optional clientMessageId UUID is scoped to ticket and author type with a unique constraint.
Exact retries from the same author return the current conversation without adding a message,
changing timestamps or resetting the allowance. Reusing the UUID with different text or another
support author is rejected. Both customer and admin composers keep the UUID while retrying the
same unchanged text and generate a new UUID after editing or successful persistence. API clients
should provide a stable UUID per intended message; legacy clients omitting it retain compatibility
and each successful request is a distinct message. Retry IDs never bypass ownership checks or
permit reopening a closed ticket. Closed tickets still reject new customer/support messages.

Customer detail returns remainingMessages and canReply. At five unanswered messages the composer
is replaced with the requested waiting explanation and an urgent support link to /contact. This
link does not send a sixth message or reset the ticket counter. Remaining allowance is announced
through an accessible live region. Private notes, operator identities and quota internals are not
added to the public marketplace or another customer's payload.

Post-creation browser UAT found a delayed server refresh could leave the visible conversation
and allowance one reply behind the persisted record. Successful reply actions now return the
safe customer ticket snapshot; the detail component applies it immediately. Older refresh
snapshots cannot replace a conversation containing a later message, and snapshots are bound to
the ticket ID. Newer server messages and lifecycle updates still take precedence. This uses
the server's actual saved result, not an optimistic local quota increment. The regression test
covers stale refresh, the fifth-message block, a newer server snapshot and navigation to another
ticket. No admin/private metadata is added to the customer snapshot.

Migration 20261010120000_ticket_message_limits is additive and transactional. It counts historical
CUSTOMER messages after the latest SUPPORT timestamp, caps over-limit records at five while
preserving every message, and leaves empty tickets at zero. Legacy same-timestamp ordering cannot
be recovered reliably from random UUIDs; customer messages sharing the latest support timestamp
are conservatively counted. New writes use the locked counter and do not depend on timestamp
ordering. Existing author labels, attachments architecture and lifecycle values remain unchanged.

Apply schema before the new writer. Coordinate API rollout so old writers that do not maintain
the counter are drained before enabling the new quota; mixed old/new writers would invalidate
the denormalized counter. Use a reviewed forward fix, not deletion of history, if rollback is
needed. Clean, representative legacy, constraint and transactional rollback rehearsals are in
ticket-message-migration.test.ts. No production migrations or data modification were executed.

Unit, real database/API concurrency, retries, closed/reopened lifecycle, authorization and UI
cases live in the contracts, ticket-message-limits.test.ts and support component suites. Actual
post-creation browser evidence and final-head CI must pass before PR 9 begins. No claim is made
that the historical 556 manual scenarios all currently passed.

Owner UAT: create a synthetic request, send five replies, check that the sixth is blocked, then
reply as support and confirm five new slots. Retry a saved message with the same UUID, check
another ticket's allowance, internal-note non-reset, refresh, multi-device submissions, closed
restrictions and unauthorized access. Mask contacts and private notes in screenshots.

DO NOT MERGE. No production deployment.
