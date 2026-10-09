# Shared dealer directory illustration

Every public directory card uses `/brand/dealer-directory-cover.svg`, the same
local, brand-neutral conceptual illustration. It depicts a generic building and
unbranded cars; it is explicitly described as a shared illustration rather than
a photograph of the named dealer. The fixed card cover height and intrinsic
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

Base: `fix/dealer-email-uniqueness` (#288), validated head `9ad0c9e3`.
No production deployment or merge. Complete post-creation tests and final-head
CI before starting the service-locations PR.
