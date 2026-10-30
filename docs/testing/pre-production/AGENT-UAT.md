# Actual browser journeys and evidence

Baseline `d6ae115359c4d0ae7ab0fd5115336291666cbb08` · 2026-10-02 (Asia/Calcutta, UTC+05:30). Local isolated pre-production simulation; no production connection or application fix.

Actual Chromium interaction was used: typing search and phone fields, pressing Enter, clicking filters and cards, gallery arrows/fullscreen, closing/reopening/Escape, scrolling to the footer, back/forward, refresh, account menus and viewport changes. This was not URL-only status checking.

| Journey                                                                  | Outcome / scope                                                                                     | Evidence                                                 |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Anonymous homepage → search → cars                                       | PASS in desktop/tablet/mobile engine                                                                | evidence/{desktop,tablet,mobile}/uat.json                |
| Filter → refresh → clear → browser history                               | PASS in all three sizes                                                                             | same records                                             |
| Gallery arrows → fullscreen → close → reopen → Escape                    | PASS in all three sizes                                                                             | car-gallery.png and UAT-003                              |
| New customer login → account Saved/My Enquiries                          | PASS local desktop signup; subsequent repeated signins blocked by shared widget allowance           | desktop UAT-004; later blocked rows preserved            |
| Save → remove → save                                                     | PASS through real mobile buttons                                                                    | JOURNEY-customer                                         |
| Enquiry prefill → cancel/reopen → send → history                         | PASS mobile/tablet with existing authenticated state; fresh mobile lead chain passed                | targeted-browser.json / golden-browser.json              |
| Customer lead → STAFF contact → MANAGER close → customer CLOSED          | PASS mobile UI; DB confirms both individual actors/times                                            | golden-browser.json; final-database-snapshot.json        |
| Admin search → open same enquiry → history                               | Reviewed transition chain present                                                                   | admin/golden-enquiry-history.png and ADMIN-BROWSER-chain |
| OWNER/MANAGER/STAFF personal menu → dealer dashboard/inventory/enquiries | PASS mobile with customer-scope setup fixtures                                                      | targeted-browser.json                                    |
| OWNER invite dialog cancel/reopen                                        | PASS mobile; no invitation created by this UI case                                                  | dealer-owner/team-cancel-reopen.png                      |
| STAFF partial draft save → refresh                                       | PASS mobile                                                                                         | dealer-staff/mobile-draft-persisted.png                  |
| Dealer directory → portfolio                                             | Portfolio screenshot captured; combined 404 check blocked, so full combined journey not marked PASS | dealer-portfolio.png; UAT-007                            |
| Invalid public route                                                     | FAIL branded experience at all sizes                                                                | BUG-007                                                  |
| Admin mobile sizing                                                      | FAIL; 423 > 390                                                                                     | BUG-008                                                  |

Screenshots reviewed included the public homepage/car detail, mobile enquiry history, Team, staff contact/draft, manager closure and Admin enquiry detail/list. Admin detail correctly shows category “Dealer” for audit entries; the first extra expectation of individual names there was not a defined requirement and was reclassified BLOCKED, with initial evidence retained. DB and dealer UI retain the individuals.

Browser fixture authentication uses actual session issuance for setup and fake Google/OTP only in isolated tests. It does not certify real OAuth, SMS or production cookies. Earlier selector/navigation timing mistakes are preserved under original-attempt; corrections changed harness logic only. Desktop state was logged out during the blocked persistence attempt and was not falsely treated as logged in afterward.

Human results are entirely PENDING. Real mobile keyboards, Safari/Firefox/Edge/Android, outage recovery and complete GOLDEN-001 through GOLDEN-010 remain outstanding. [HUMAN-UAT.md](HUMAN-UAT.md) supplies independent verification instructions.
