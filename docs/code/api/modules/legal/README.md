# Dealer acceptance and publication

Platform AdminMembers with SALES_REP verify dealer contacts and save dealership
business details; their mandatory work ends there. They may optionally upload
available documents, submit the application and prepare/submit vehicle listings
for review without accepting for the dealer. Existing scope and role checks apply.

Admin dealership approval, including the documented manual exception, is an
internal review decision. It does not require or record owner policy acceptance.
Normal approval still requires verified documents; manual activation leaves
outstanding documents unverified and retains its disclaimer/audit requirements.

The dealership owner accepts the current policies through their own authenticated
account on first entry. The existing gate works for saved drafts and approved
dealers without document uploads. It resumes the requested onboarding location,
records agreement once and never fabricates acceptance for admin or staff actions.
Dealer account actions remain gated until acceptance.

An admin cannot publish a listing until owner agreement exists. The review page
shows this in its existing blockers and disables approval. The same condition is
rechecked in the transaction, and every listing transition into ACTIVE (including
reactivation/relisting) checks agreement centrally. Acceptance never publishes a
car automatically; the reviewer must still approve and all normal checks apply.
Published V1 text, versions and historical evidence are unchanged. No migration
or additional environment setting is needed. Existing published inventory is not
retroactively removed.

API tests pin preview off so local preview settings do not affect unrelated
fixtures; acceptance scenarios enable it explicitly.
