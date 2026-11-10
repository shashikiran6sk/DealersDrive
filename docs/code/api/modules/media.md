# api / modules/media

Parent: [api](../../README.md)

The notes below belonged to the files named under each heading. Each heading is the
declaration the note sat above.

## `apps/api/src/modules/media/media.docs.ts`

### `export const storageDocs: ModuleDocs =`

The three routes that stand in for Cloudflare R2 in local development.

Mounted outside `/v1` on purpose: they are storage, not API surface. In
production these are R2 and the Cloudflare Images origin, and no client code
changes — the presign response and the signed read URL already point
wherever the bytes are.

**R45 withdrew `mediaDocs`** with the dealer routes it described
(`/v1/dealer/media/presign`, `…/:id/commit`, `GET`/`DELETE …/:id`). A dealer
never writes vehicle media; the admin upload is documented by the
[`vehicle-images`](vehicle-images.md) module under the same tag.

## `apps/api/src/modules/media/media.facade.ts`

### `export { toMediaStatus } from './media.service.js'`

`media` as other modules see it (ARCHITECTURE §5.5 rule 3).

`toMediaStatus` maps a stored status onto the one the dealer is shown, and the
yard photograph has to render it. The processing pipeline behind it does not
leave this module.

## `apps/api/src/modules/media/media.routes.ts`

### `export function storageRoutesFor(driver: Env['STORAGE_DRIVER']): StorageRoute[]`

The endpoints that stand in for R2 locally — mounted **only for the local
driver**. Behind minio or r2 the adapter's `presignPut()` and
`signedReadUrl()` return real S3 presigned URLs, so `PUT /uploads` and
`GET /private` have no caller there. Mounted anyway, they forwarded any
request carrying a valid HMAC straight to the bucket through the configured
`StoragePort`, and `UPLOAD_SIGNING_SECRET` has a committed default: anyone
could overwrite a live vehicle image, plant objects in another dealership's
KYC prefix, or read a private document by key (ORIG-BUG-001). The public
`GET /media/by-media/:mediaId/:width.webp` stays for every driver; it is gated
by listing and dealer visibility, not by a signature. `createStorageRouter`
takes the driver as a parameter (defaulting to `env.STORAGE_DRIVER`) so the
choice is testable without reloading configuration.

`PUT /uploads` terminates the presigned upload: it verifies the HMAC, the
expiry, the declared content-type and the declared content-length before a
byte is written — the same conditions an S3 presigned PUT enforces.

`GET /private` answers the local adapter's `signedReadUrl()`: the key, its
expiry and an HMAC over both, signed with the literal content type `read` so a
read URL can never be replayed as an upload. Before R45 the local adapter
handed out `/private/<key>` URLs that nothing served, so a yard photograph or
KYC preview was a broken image in development; the moderator's preview of an
unpublished vehicle image is what made it matter. An expired, altered or
misdirected signature is a plain 404 — never a hint about which part failed.

**The dealer media router is gone (R45).** It took an `ownerType` and a
client-supplied `ownerId` and put the latter in the storage key without
checking that the dealer owned it. Rather than repair a route the product no
longer has a use for, it was removed: there is no dealer path that writes
vehicle media at all.

## `apps/api/src/modules/media/media.processor.ts`

### `export function createMediaProcessor({ prisma, storage, queue }: MediaProcessorDeps)`

Restores the processing step the reconstruction cut (**F034**; `CONTEXT.md`
§7b on the `docs` branch). A committed upload is `READY` straight away and
served as its original; this writes `320`, `640`, `1024` and `1600` WebP
derivatives beside it and records them in `media.variants`, which `locate()`
in `media.service.ts` already prefers. Nothing about delivery changed: the
URL, the visibility check and the ETag scheme are the same, and the ETag is
derived from the key, so a browser holding the original is sent the
derivative on its next revalidation.

**It is not on the facade.** The facade test forbids any pipeline operation
crossing the module boundary. A committing module records a `MediaUploaded`
event instead (`recordMediaUploaded` in `platform/media/uploaded.ts`), and
`subscribe` below turns it into a job.

### `export const PROCESSED_OWNERS: readonly MediaOwner[]`

The owners whose images are delivered publicly: vehicle photographs, and
dealership photographs (`DEALER_PORTFOLIO`, and the legacy `DEALER_COVER` rows
#299 carried over), which are served by the same route at the same widths.
Yard-visit evidence and KYC documents have no public path and are never
resized.

#373 started with vehicles only, because the portfolio removal path deleted only
`storageKey` and would have left four derivatives behind per removal. Every
delete path now goes through `mediaObjectKeys` (`platform/media/keys.ts`), and
a portfolio key gets its own derivative names (`derivativeKey` in
`platform/media/derive.ts`), so dealership photographs are resized too.

### `async function process(mediaId: string): Promise<ProcessOutcome>`

`skipped` for anything that is not a `READY` vehicle photograph without
derivatives, so a duplicate job, a retry and the backfill script all find
nothing to do the second time.

`unreadable` — a missing original, or bytes sharp cannot decode — is logged
and returned, not thrown. pg-boss retries a thrown job, and decoding the same
bytes again cannot succeed; the photograph keeps being served as its
original, exactly as before this existed. A storage _error_ does throw, and
that is the case a retry can fix.

The derivatives are written first and recorded second, with the same
conditional `updateMany` the commit uses: if the image was removed while it
was being resized, nothing is recorded and the files just written are
deleted, so no object is left that no row names.

### `subscribe(bus: EventBus): void`

Turns a `MediaUploaded` event into a `media.process` job. A required
subscriber: when the queue refuses the job the publish fails and the outbox
row is retried, rather than the request being logged and dropped. The upload
that raised the event has long since been answered, so a retry costs the admin
nothing. A payload without a media id is refused, which leaves the row for
someone to look at rather than marking it handled.

## `apps/api/src/modules/media/media.backfill.ts`

### `export async function backfillMedia({ prisma, processor, dryRun, write })`

The one-off pass for every public photograph committed before the
`media.process` job existed (**F034**): `READY`, one of `PROCESSED_OWNERS`,
`variants` still `{}`, oldest first. Dealership photographs became eligible
after #373, so a run after this change picks them up as well. It calls the same `process()` the job does, so it
is safe to run twice — the second run finds nothing, because a processed row
no longer has empty `variants`.

A photograph it cannot read is counted and left as it was, still served as
its original, so one bad file never stops the rest. `--dry-run` lists the
rows and touches nothing, which is how to see what a production run would do
before doing it.

It is a function in `src` rather than a script in `scripts/` because it has
to run **inside the production image**. That image (`apps/api/Dockerfile`,
target `runner`) carries only `dist/` and production dependencies — no
`scripts/`, no `tsx` — so a TypeScript script could not run there at all.
Compiled into `dist/`, it runs with `docker exec` in the API's own container,
with the database, storage credentials, network and working directory the
API already has. The working directory matters for `STORAGE_DRIVER=local`,
whose root is resolved from it.

## `apps/api/src/modules/media/media.service.ts`

### `async serve`

Resolves a delivery request to stored bytes. A new upload has a new id, but authorization and readiness remain mutable.

**A vehicle image is public only while its listing is visible — `ACTIVE`, or
`RESERVED` since R71, because a reserved car's card and page are still shown
(R45, R71), and its dealership is `ACTIVE`.** The rules are contracts' `isListingPubliclyVisible` and the shared search `PUBLIC_DEALER_STATUS`, the same ones the
search's visible predicate spells. The media row is read with its
`vehicle_media` attachment, the vehicle and the listing, and anything else — a
pending review, changes requested, rejected, sold, withdrawn, or an image
attached to nothing — is the same 404 as an id that does not exist. A moderator previews unpublished images through a signed read
URL instead.

### `async function isPubliclyServable(media: ServableMedia): Promise<boolean>`

**A dealership photograph is public only while an APPROVED portfolio row names
it and its dealership is `ACTIVE` (#299, carrying BUG-NEW-009 forward).** It
used to be served whatever happened to its dealership: during a suspension the
vehicle images went 404 while the yard photograph — the image that fronted the
portfolio — stayed 200, and a DRAFT or pending applicant's photograph was
public by id before anyone had approved it. The rule is one `count` of
`dealer_portfolio_photos` rows that name this media, are APPROVED and belong
to a dealership whose status is `PUBLIC_DEALER_STATUS`. It covers
`DEALER_PORTFOLIO` and the legacy `DEALER_COVER` rows the #299 migration
carried over, so a pending, rejected, replaced or taken-down photograph is the
same 404 as an id that does not exist. The dealer and the reviewer see it
through a signed read URL, which is unaffected.

**Every other owner type is refused.** Only vehicle images and approved
portfolio photographs are ever delivered here. Yard-visit photographs
(`DEALER_YARD_VISIT`) are internal evidence and have no public path; a logo
has no upload path and KYC documents do not create media rows. A future
owner type is private until a rule for it is written, rather than public
because nobody thought to write one.

**Widths (BUG-NEW-011).** Any whole number from 1 to 4000 passes `MediaPath`.
A width the processor wrote (320, 640, 1024, 1600) gets that derivative; any
other gets the largest one there is, then the original. The reference used to
say every other width was a 404, which a client could have coded around; it
now describes the route as it behaves.

**A missing derivative is logged, not hidden.** When `locate()` answers without
the width it was asked for, it logs `media.variant_missing` at warn with the
media id, the width and what it served, and counts
`dealers_drive_media_variant_fallbacks_total{served}`: `original` when nothing
was resized and the full upload goes out, `variant` when a derivative width
(320, 640, 1024, 1600) is missing and a larger copy stands in. A width outside
that list answered by a derivative is the route working as designed and says
nothing.

The fallback itself stays. A heavy image is a slow page; a 404 is a car with
no photograph, and it would also turn every hiccup in processing into a broken
gallery. What was wrong in production was that the fallback was silent: every
card on the homepage served a 450 KB–1 MB original behind a URL that said
`640`, for as long as F034 was missing, and nothing showed it. The warning
makes that state visible in Loki and the counter makes it alertable.

The derivative route sets `Cache-Control: no-store` before validation and delivery, including denials. A READY image may become unavailable after suspension or a listing decision; an unchanged URL must consult the current state again. This also prevents a cached denial from outliving reinstatement. Private signed previews retain their existing authority and private/no-store behavior. Requested derivatives, larger fallbacks and original MIME types are unchanged. Previously retained client/CDN bytes cannot be recalled by this header; deployment must account for caches populated under the old year-long policy.

**Revalidate, do not re-download (R108).** `no-store` on a successful response
meant a browser never kept an image, so every view of every gallery streamed the
bytes from S3 through the API again — on the t4g.small that serves the whole
API. A successful response now sends `Cache-Control: no-cache` and a strong
`ETag`. `no-cache` lets the browser keep the bytes but forbids reusing them
without asking, so the property above still holds: every reuse is a
conditional request, and `locate()` runs the same READY and visibility checks
on it as on a first view. Still public → `304`, and `read()` (the S3 download)
is skipped. No longer public → `404` with `no-store`. Nothing is ever served
from a cache without the current state being consulted, and the public listing
APIs stay the source of truth for what is visible.

The ETag is `sha256(mediaId:key)` rather than a hash of the bytes, so it can be
known before the download. That is sound because an object's bytes never change
under its key: every key embeds the media id, a random UUID minted for one
upload, and a replacement image is a new media row. The `m1-` prefix versions
the derivation. No `max-age` or `immutable`: a bounded lifetime would let a
browser show a suspended dealer's car without asking. Private reads
(`GET /private`, KYC documents, yard previews) are unchanged — `private,
no-store` — and KYC documents never reach this route at all.

**Reviewed again with F034 (no change).** The derivatives are immutable per
media id and width, so a `max-age` would be safe for the _bytes_. It would not
be safe for _visibility_, which is the reason above: a withdrawn listing or a
suspended dealership has to stop showing on the next view, and nothing but a
revalidation tells the browser that. The cost of `no-cache` was never the
revalidation, which is a 304 with no storage read; it was the size of the
bytes behind a 200, and F034 is what fixed that. Moving the ETag from the
original's key to the derivative's key (`imageEtag(mediaId, key)`) is also
what delivers the derivative to a browser that cached the original: its
`If-None-Match` no longer matches, so it gets a 200 with the small file. No
cache needs purging.

### `export function toMediaStatus(status: string): 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED'`

`ORPHAN` is a storage-lifecycle state, not something a dealer can act on —
the contract exposes four states and a deleted upload reads as FAILED.
