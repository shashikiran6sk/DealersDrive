# API authorization and validation evidence

Baseline `d6ae115359c4d0ae7ab0fd5115336291666cbb08` · 2026-10-02 (Asia/Calcutta, UTC+05:30). Local isolated pre-production simulation; no production connection or application fix.

Anonymous requests to dealer vehicles/team/enquiries, Admin dealers/enquiries and customer saved/enquiries returned 401. A customer with no membership returned 401 on dealer APIs. STAFF privileged listing routes returned 403; MANAGER/STAFF Team invitation routes returned 403; all tested non-admin account types returned 401 from Admin aggregation.

Foreign-tenant vehicle read/edit/delete returned the same 404 as an unknown ID and left the row unchanged. Malformed UUID returned 400. Privileged extra fields were rejected rather than assigned. Separate integration assertions cover enquiry tenant isolation, invitation identity/replay, protected profile/document permissions and final-owner protection.

Open security findings: incomplete dealer approval (BUG-002), member mutation after removal commits (BUG-005), production MinIO acceptance (BUG-006), and post-suspension public media consistency (BUG-004). Production cookie/CORS/CSRF behavior, complete error leakage, deployed rate limiting and real OAuth/OTP provider behavior remain BLOCKED unless an exact registry case says otherwise. The local widget bucket’s exhaustion is expected limit behavior, not a production availability defect.

Evidence: [probes](evidence/security/api-probes.json), [actual-route follow-up](evidence/security/followup-probes.json), [config validator](evidence/security/config-probes.json), [revocation race](evidence/concurrency/revocation-in-flight.json). No tokens, private signed URLs or provider credentials are in this evidence bundle.
