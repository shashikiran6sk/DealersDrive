# Listing insurance and admin management

Insurance is a required, manually maintained None/Live choice. Expiry dates are no longer accepted by the write contract or returned by dealer/admin vehicle DTOs, review rows or public specifications. Dealer and Sales forms share the same fields and validation.

Migration `20261023100000_insurance_status` converts Comprehensive and Third party coverage valid through the migration date in Asia/Kolkata to Live; expired coverage becomes None. Existing None values stay None. Unknown types or insured records without dates become null, so the ordinary completeness issue list asks for confirmation. The historical expiry column is retained privately for investigation; new code neither reads it publicly nor writes it. Live does not expire automatically.

The enum migration and API/frontend release must be coordinated: old API processes cannot write their previous insurance values after the enum conversion. This migration does not alter listing visibility or publication status. The migration rehearsal checks populated records, both coverage types, yesterday/today/tomorrow, missing dates, preservation of historical fields, strict final enum values and transactional rollback.

Admin edits use the listing lock and an expected vehicle timestamp. The API allows Pending Review, Changes Requested, Active and Reserved. Live inventory cannot be left incomplete; failed edits roll back data and audit records. Registration uniqueness and make normalization continue to apply. Updating a reviewed vehicle clears its verification checks; updating a published vehicle keeps its URL and publication date. Audit values store money as decimal paise strings.

Moderators and super admins may reserve Active listings or sell Active/Reserved listings through the state machine. Support, Sales and dealer sessions cannot use these admin endpoints. Terminal listings remain closed.

A missing established year produces no portfolio age row or directory age suffix. Clearing the optional profile field writes null; omitting it leaves it unchanged. Response time is no longer included in public dealer statistics; historical measurements are retained.

Validation: contracts, API unit/integration, web interaction tests, full lint/typecheck/test/build gates, and desktop/mobile sandbox review.
