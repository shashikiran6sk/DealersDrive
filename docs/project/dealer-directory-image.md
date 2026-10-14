# Shared dealer directory illustration

Every public directory card uses `/brand/dealer-directory-cover.svg`, the same
local conceptual illustration. Since **R118** it is the Dealers-Drive showroom
illustration (1600 × 640): a generic building carrying the platform's own DD
sign, and unbranded cars — never a dealer's name or any real dealership's
likeness. It is explicitly described as a shared illustration rather than a
photograph of the named dealer. The same asset is the dealer page's hero
fallback when a dealership has no approved photograph, so one dealership looks
the same on its card and its page until it publishes photographs. The fixed card cover height and intrinsic
image dimensions preserve layout while loading. One cacheable asset is shared
by all cards; no per-dealer upload or storage copy is created.

Directory APIs return the shared cover address and no longer query yard media
for directory cards. Frontend cards always select the shared asset, including
when stale/cached data contains a dealer-uploaded photo URL. The “Yard Verified”
cover pill is removed: neither a generic illustration nor a photo proves a
physical visit or ownership. Genuine dealer verification is a separate later
campaign PR; existing approval behavior is otherwise preserved here.

Uploaded yard media remains on individual ACTIVE dealer detail pages only when
ready/servable under existing media authorization. Existing single-image/fullscreen
viewer interactions remain. The current model stores one yard cover per dealer,
not a multi-photo yard gallery; multiple vehicle-photo gallery behavior remains
unchanged. No migration, photo deletion or automatic re-upload occurs.

Yard photography is optional in backend completeness and submission, and the
upload interface describes it as optional/detail-only. Identity/business fields,
private document checks, verification/review permissions and approval guards
are retained. Existing photo upload, replacement and explicit removal behavior
is unchanged; this PR performs no deletion of existing files.

**Since #299 (draft).** Onboarding no longer collects a yard photograph. An
individual dealer page shows the dealership's _approved_ portfolio photographs
(`docs/project/progressive-dealer-onboarding.md`); a legacy yard cover became
an approved legacy portfolio photograph for ACTIVE and SUSPENDED dealerships.
Directory cards are unchanged: they keep this shared illustration.

Validation covers identical asset selection with/without uploaded photos,
private/unready media, zero directory yard queries, submission without a yard
photo when required evidence is present, photo/detail authorization regressions,
directory filters/pagination/navigation, accessible image text and responsive
card geometry. Browser evidence must come from the actual branch application.

Browser validation exposed an existing task-cache declaration issue: no-emit
typecheck cached `dist/**` and could restore an older API build after compilation.
The typecheck cache now retains only its build-info output. Actual production
builds run after validation and the emitted API/shared image URL is checked
before browser certification. This preserves the current-branch testing boundary;
no CI check or threshold is removed.

Owner UAT: open `/dealers` and compare cards with and without uploaded yard
photos. Every card has the same illustration and no yard-verification claim.
Open an individual dealer with approved yard media and verify its existing
viewer; missing/unapproved media must not appear. Submit a synthetic application
with valid required business/identity evidence and no yard photo. Verify card
navigation, search/filter/pagination and mobile layouts.
