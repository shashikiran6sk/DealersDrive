# Tenant and customer isolation

Baseline `d6ae115359c4d0ae7ab0fd5115336291666cbb08` · 2026-10-02 (Asia/Calcutta, UTC+05:30). Local isolated pre-production simulation; no production connection or application fix.

Vehicle/draft/enquiry/team ID-taking routes were exercised across OWNER, MANAGER and STAFF in the integration suite. Foreign rows produce 404 and remain unchanged. Direct probes repeated vehicle GET/PATCH/DELETE versus a missing UUID. Requests cannot choose dealerId or customerId through additional fields. Enquiry customer and dealer derive from the authenticated person and listing.

Personal saved/enquiry collections remain keyed by user, independent of employer membership. Removing STAFF preserved a competitor saved car and personal enquiry, denied dealer operations, and retained the staff-created dealership draft. The complete employer/competitor browser golden path and every private storage boundary remain blocked.

Evidence: dealer-tenancy-hardening / dealer-roles / enquiries / saved-vehicles exact assertions in [api-assertions.json](evidence/ci/api-assertions.json), API-PROBE-006/008/012/013 and API-FOLLOWUP-001. BUG-005 is temporal authorization leakage within a former tenant, not an observed cross-tenant read.
