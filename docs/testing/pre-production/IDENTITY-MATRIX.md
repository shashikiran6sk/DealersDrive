# Human identity and workspace separation

Baseline `d6ae115359c4d0ae7ab0fd5115336291666cbb08` · 2026-10-02 (Asia/Calcutta, UTC+05:30). Local isolated pre-production simulation; no production connection or application fix.

| Identity/context operation              | Observed                                                                                               | Limit                                                                                        |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| Phone customer signup and repeat signin | One human identity; normal desktop UI signup passed locally                                            | Fake OTP driver; live MSG91/SMS not certified                                                |
| Phone plus Google linking               | Integration tests converge to one account and refuse collisions                                        | Google provider replaced with fake claims                                                    |
| Customer scope → dealer workspace       | Real STAFF customer API login adds no session; OWNER/MANAGER/STAFF mobile UI workspace switch succeeds | OWNER/MANAGER browser fixture sessions were issued for setup; not proof of normal real login |
| Dealer person → personal collection     | Human/customer ID supplies Saved Cars and My Enquiries                                                 | Full competitor-data golden journey not entirely exercised in browser                        |
| Membership removed                      | Dealer requests 401, personal requests 200; saved/enquiry/draft rows survive                           | In-flight write can still commit, BUG-005                                                    |
| Dealer suspended                        | Dealer denied; personal customer capabilities preserved                                                | Every multi-dealer fallback and browser-tab interaction not exhausted                        |
| Admin identity                          | ADMIN scope plus active authorization; person scopes rejected                                          | Browser fixture authenticates setup only; real Google flow blocked                           |

User phone is unique; OAuth identity is keyed by provider/subject; sessions store hashes, scope, expiry and revocation. Multiple memberships resolve through membership-owned workspace choices. These are source architecture findings, with supporting executed assertions recorded individually; source inspection is not PASS.

Evidence: [unified-session/identity-linking assertions](evidence/ci/api-assertions.json), [personal-access probes](evidence/security/followup-probes.json), [workspace/browser measurements](evidence/targeted-browser.json).
