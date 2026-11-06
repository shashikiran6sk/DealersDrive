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

## `apps/api/src/modules/legal/legal.service.ts`

### `const STILL_ACCEPTED` — Terms 1.1 and acceptances of 1.0

A new acceptance is always recorded against the current versions
(`LEGAL_TERMS_VERSION`, now `terms-v1.1`). The gates (`hasDealerAcceptance`,
`hasPersonalAcceptance`) instead accept any Terms version in
`LEGAL_ACCEPTED_TERMS_VERSIONS` with the current Privacy Policy version.

Terms 1.1 only corrects the description of vehicle photography: 1.0 said "We
currently photograph vehicles", and some listings now carry the dealership's
own photographs, checked against the photo standard. It adds no obligation,
so the owner chose not to make every customer and dealership owner accept it
again. Had the gates kept requiring an exact match, every customer would have
been refused enquiries, and every dealership owner refused publication and
relisting, until they accepted again. A later version that changes what
anyone agrees to is left out of the list, and so is accepted again. The
receipts themselves are untouched: a 1.0 receipt still records that 1.0 was
accepted, and the 1.0 text remains in `legal-documents/v1.ts` under its
original hash.
