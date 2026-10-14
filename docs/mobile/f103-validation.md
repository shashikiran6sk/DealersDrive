# F103 Home and dealers — validation checkpoint

Immediate base: F102 branch feat/f102-mobile-cars-search-gallery at dab6e7ab745e54703e83e532f24eeca1ded5bd23 / draft PR #315. F101's repaired head 7046f543 and F102 reported all GitHub checks successful; all remain open/unmerged above #279 / 6180a4b. Main stays unchanged.

Home hero/search/discovery/info, dealer directory/typeahead/district/town scope, profiles/approved yard galleries/address/directions and scoped inventory/search/filter/paging are implemented with existing public APIs. Existing hero/WebP and conceptual directory SVG are copied unchanged. Customer-only navigation excludes dealer/admin console interfaces. No API, database, legal, identity or website UI change and no new dependency.

Local evidence: eleven native suites / 59 tests PASS; boundaries/lint/type checks and root lint/types/docs PASS; Android Hermes export PASS (3.9MB artifact, not a performance claim). New tests cover server display labels/conceptual cover, public-only directory scope/page requests, fixed-dealer inventory queries and location-filter exclusion. Existing native car/auth tests remain passing.

Installed native gallery/scroll/back/keyboard/inset/image quality, actual performance and physical-device screenshots remain unavailable locally. No synthetic/native screenshot is fabricated. Maps is never fetched/rendered automatically; only a valid supplied URL opens on user action. No raw dealer contact phone is invented or exposed. Saved/enquiry/support/account management remain subsequent stack milestones.

See [implementation details](../code/mobile/dealers-home.md). Reject/revert the unmerged native child normally for rollback; no migration or protected-branch rewrite. Production deployment, legal activation, signing and Play submission remain separately gated.
