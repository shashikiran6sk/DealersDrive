# api / modules/dealer-photos

Parent: [api](../../README.md)

Dealer photographs (partially revises **R45**). R45 made Dealers-Drive the only
photographer. A dealer may now photograph the car themselves — but a dealer's
photograph is never published as it is. It is raw material: the review team
downloads it, checks it against the ten-shot photo standard, processes it in
StudioCar and uploads the finished file through the existing admin image routes
(`modules/vehicle-images`) with credit `DEALER`. Only that file can reach a buyer,
and the public vehicle page already tells the buyer the dealer took it.

Everything is behind `feature.dealerPhotos`, which ships **off**: every write is
`409 DEALER_PHOTOS_DISABLED` and submission asks for nothing new.

## Why a separate table

Raw photographs live in `vehicle_submission_photos`, not `vehicle_media`, and
their `media` rows have owner type `VEHICLE_SUBMISSION`. `vehicle_media` is the
public gallery: the search mapper, the vehicle page and the media route all read
it. Keeping raw files out of it means no public read path has to remember to
exclude them — and the public media route (`modules/media/media.service.ts`,
`isPubliclyServable`) refuses any owner type it does not name, so this one is
refused by default. The integration test asserts a raw photograph 404s publicly
even after its car is live.

## `apps/api/src/modules/dealer-photos/dealer-photos.service.ts`

### `export function submissionPhotoKey(vehicleId, mediaId, slot, mimeType)`

`vehicles/{vehicleId}/submitted/{mediaId}/{slot}.{ext}`. The slot travels in the
server-chosen key rather than in a second table or a commit body, so commit
cannot attach a file to a slot it was not presigned for. `slotOfKey` reads it back.

### `async setPlan(actor, vehicleId, plan)`

`DEALERS_DRIVE` needs the dealership's district to have `photographyAvailable`
(the admin's service-locations switch; the seed turns it on for every Tamil Nadu
district, so operations must narrow it to where the team actually shoots —
today, Vellore). Changing the plan keeps the photographs already uploaded: a
dealer asked for changes may switch either way.

### `async commit(actor, vehicleId, mediaId)`

The same verification as an admin upload — the stored object's length against the
declaration, its first bytes against JPEG/PNG/WebP — then, under the listing lock,
the photograph is attached. A standard slot holds one photograph (a partial unique
index, `WHERE slot <> 'EXTRA'`), so a second upload replaces the first and the old
file is queued for deletion. Up to `DEALER_PHOTO_EXTRAS_MAX` extras.

### `async adminSubmitted(listing)`

For the review screen, in the guide's shooting order and named for the car as the
dealer listed it — `2016-hyundai-creta-sx-01-front-three-quarter-driver-side.jpg`
(`vehicleFileBase` and `submittedPhotoDownloadName` in contracts) — so a folder of
downloads is already a StudioCar batch in order. A car with no make or model yet
falls back to its registration number, so a file is never called `-01-….jpg`. The
thumbnail URLs are 15-minute signed reads.

### `async adminDownload(admin, listingId, input)`

Downloads are links straight to storage, not bytes through an app: a Vercel
function answers at most 4.5 MB and a set of ten phone photographs is 25–40 MB,
and in production `API_BASE_URL` is the public web origin, so an API route the
browser fetches directly is not reachable either. The answer is a five-minute
signed read whose `ResponseContentDisposition` saves it under its StudioCar name —
without that a cross-origin signed URL opens the image in a tab, because browsers
ignore the `download` attribute across origins.

With `mediaId` it is that one photograph. Without, it is every photograph as one
zip, `2016-hyundai-creta-sx.zip`, built once (`storedZip`) and kept at
`archives/submitted-photos/{listingId}/{fingerprint}.zip`. The fingerprint is a
hash of the archive name and each entry's media id and name, so a replaced photo,
a new extra or a renamed car is a new archive and an unchanged set is served from
storage without rebuilding. Every download is audit-logged
(`listing.submitted_photos_downloaded`) through `recordDetached`, because the
download is a read and has no transaction of its own to join.

`422 NO_SUBMITTED_PHOTOS` when there is nothing to zip; `404 PHOTO_NOT_FOUND` for
a `mediaId` that is not one of this listing's photographs, so a moderator cannot
sign a read for some other object by guessing an id.

### `export function submittedPhotosArchiveKey(listingId, contents)`

Archives are derived data: deleting the `archives/` prefix loses nothing, since
the next download rebuilds them. An R2 lifecycle rule expiring it after a few
days keeps it from growing.

## Where the files live

One bucket, private, three prefixes:

| Prefix                                                               | Written by                                                         | What                                    |
| -------------------------------------------------------------------- | ------------------------------------------------------------------ | --------------------------------------- |
| `vehicles/{vehicleId}/submitted/{mediaId}/{slot}.{ext}`              | the dealer's browser, by presigned PUT                             | raw photographs — never public          |
| `vehicles/{vehicleId}/{mediaId}/…` (the existing vehicle-image keys) | the admin's browser, by presigned PUT, in `modules/vehicle-images` | the finished StudioCar files buyers see |
| `archives/submitted-photos/{listingId}/{fingerprint}.zip`            | the API                                                            | "Download all" zips                     |

### `UNSORTED`

A photo uploaded "all at once" names no shot: the dealer picks a gallery's worth
in one go and the review team places them, which is the reason the option exists.
It is a slot value rather than a null so the server-chosen key, the one-per-shot
index and the readiness rule all keep working: the partial unique index excludes
it alongside `EXTRA`, and up to `DEALER_PHOTO_UNSORTED_MAX` (sixteen: the ten plus
the extras) may stack. In the admin's download it sorts after the named shots and
before the extras, oldest first, as `…-11-photo.jpg`.

## `apps/api/src/modules/dealer-photos/submission-readiness.ts`

### `export async function assertPhotosReady(tx, listing)`

Inside the submit transaction: a plan is required (`422 PHOTO_PLAN_REQUIRED`); a
`DEALER` plan needs all ten standard shots (`422 PHOTOS_INCOMPLETE`, one field
error per missing slot, `photos.<SLOT>`) — or, once any photo was uploaded "all at
once", ten photographs in total (`422 PHOTOS_INCOMPLETE`, one error on `photos`
saying how many more); a `DEALERS_DRIVE` plan needs coverage
still to be there (`422 PHOTOSHOOT_UNAVAILABLE`). Only dealer submissions are
checked — a Sales Representative is Dealers-Drive staff at the yard.

### `export async function releaseSubmissionPhotos(tx, vehicle, actorId)`

A draft deleted with photographs on it: the rows go with the vehicle by cascade,
the media rows are marked `ORPHAN` and the files are queued for deletion in the
same transaction. Injected into the vehicles service rather than imported, like
the submission gate, so the service still constructs without it.
