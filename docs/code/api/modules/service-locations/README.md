# Service locations

`service-locations.service.ts` owns the geographic catalogue, versioned configuration,
and transactional audit records. Public reads exclude disabled states/districts and
strip internal aliases. Administrative mutations require `admin:config:write` as well
as the existing active admin session and console guard. Existing CSRF protections apply.

`location-validation.ts` resolves only exact reviewed aliases. It takes state then
district `FOR SHARE` locks inside the dealer transaction. A competing configuration
update must wait for admitted onboarding to commit; a completed disable is observed by
later admission. Dealer edits retain the user-before-dealer lock order when changing owner account details, then lock the dealer before checking changed coordinates;
unchanged disabled/legacy locations can retain unrelated profile edits.

Composite foreign keys and a paired-null check enforce district/state relationships.
Optimistic version predicates prevent lost administrative updates. The audit write and
configuration update share one transaction. A partial descending audit-ID index bounds the latest-history read without scanning unrelated dealer events. History exposes settings and timestamps,
without account identifiers, IPs, or personal dealer data.

New districts require a reviewed government source, start with onboarding and coverage
disabled, and receive stable internal IDs. This is a reviewed operational master-data
entry, not an external website crawler or proof of government verification. No outbound
URL fetch is performed. Authentication and onboarding never accept arbitrary locations.
