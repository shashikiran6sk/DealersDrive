# api / platform/media

Parent: [api](../../README.md)

The notes below belonged to the files named under each heading. Each heading is the
declaration the note sat above.

## `apps/api/src/platform/media/sniff.ts`

### `export function sniffImageType(body: Buffer): SniffedImageType | null`

What a file is, read from its first bytes rather than from its name or the
`Content-Type` it was uploaded with — both are whatever the client said. Only
the three types the product accepts are recognised; anything else, including
an SVG (which is script) or a GIF, is `null`. The vehicle-image commit refuses
a file whose sniffed type differs from its declared one.

## `apps/api/src/platform/media/urls.ts`

### `export const DERIVATIVE_WIDTHS = [320, 640, 1024, 1600] as const`

The widths the processor writes, and therefore the widths a srcset may name.

### `export function mediaUrl(mediaId: string, width: number): string`

The public URL of a processed image.

Five modules render images — search, vehicles, enquiries, admin and now the
public dealer pages — so this cannot live inside any one of them
(ARCHITECTURE §5.5 rule 3). It is also the single place that knows the URL
_shape_: media is addressed by id and width, never by storage key, so the
bucket layout can change without invalidating a single cached page.

The path used to read `/vehicles/by-media/…`, from the days when a vehicle
photograph was the only kind there was. A dealership's yard photograph is
delivered by the same route and the same handler, and a cover image whose URL
claims to be a vehicle's is the sort of thing somebody later writes a second
route to avoid. Renamed now rather than later, while nothing has cached one:
there are no vehicles on the platform until F055, and `media.get()` is the
only other caller.

## `apps/api/src/platform/media/derive.ts`

### `export function derivativeKey(storageKey: string, width: number): string`

A derivative lives in the same folder as the original it came from
(`vehicles/<vehicle>/<media>/640.webp` beside `…/original.jpg`), so everything
that already deletes a photograph's folder or its `variants` keys deletes its
derivatives too, and `original.webp` can never collide with one.

**A key without a folder of its own gets a suffix instead.** A dealership
photograph is stored at `dealers/<slug>/portfolio/<mediaId>` (and a legacy yard
photograph at `…/yard/<mediaId>`): the media id is the file name, not a folder.
The folder rule would put every photograph of one dealership at the same
`portfolio/640.webp`, each overwriting the last, so a key whose file name is not
`original.<ext>` gets `<key>-640.webp`. A folder `<key>/` is not an option: on
the local storage driver a file and a directory cannot share a name. Vehicle
keys keep the folder form, so derivatives already written by #373 stay where
their `variants` say.

### `export async function deriveImages(storageKey, body, widths = DERIVATIVE_WIDTHS): Promise<DerivedImage>`

The resizing half of **F034**: one WebP per width in `DERIVATIVE_WIDTHS`, and
the original's upright size.

Before this existed, every photograph was served as the camera original at
every width — a 4624 × 3359 file behind a URL that says `320`. A phone
decodes each to about 60 MB of pixels, and a car page with ten thumbnails ran
it out of memory, which is what made scrolling the gallery stutter on mobile
however fast the network was.

- **`autoOrient()`** turns a photograph the camera stored sideways upright, and
  the stored `width`/`height` are the upright ones. A phone held in portrait
  writes landscape pixels plus an orientation tag.
- **`withoutEnlargement`** keeps a photograph smaller than a width at its own
  size. `1600.webp` of an 800 px photograph is 800 px: upscaling adds bytes and
  no detail.
- **No metadata is kept.** sharp drops EXIF unless asked to keep it, and that
  is the point: a phone photograph's EXIF can carry the GPS position where it
  was taken.
- **Quality 80.** The StudioCar backdrop is `#F6F6F6`, and the car page's
  studio filter and `classifyPhoto` both look for exactly that level
  (`STUDIO_BACKDROP.level` in the web gallery, tolerance 3). At 80 it survives
  every width unchanged; a test pins it, so a quality change that shifted the
  backdrop would fail rather than leave a grey box around every car.
- **One width at a time.** Each pass decodes the original again rather than
  holding four pipelines open at once, so a 15-megapixel upload costs one
  decode's memory at a time on a worker that is also serving requests.

## `apps/api/src/platform/media/keys.ts`

### `export function variantMap(variants: unknown): Record<string, string>`

`media.variants` is a Prisma `Json` column, so it arrives typed as anything.
This reads it as a width → key map, keeping only non-empty string keys, so
`locate()` and every cleanup path read it the same way without an `as`.

### `export function mediaObjectKeys(media: MediaObjects): string[]`

Every object a media row owns: the original and each distinct derivative.
Distinct, because a photograph smaller than a width maps two widths to one
file, and the same key twice in a `StorageObjectsDelete` payload is a second
delete that can only fail.

This is the one list the delete paths use (a vehicle image removed or replaced,
a portfolio photograph removed, replaced or taken down, a rejected dealership
purged), so a derivative never outlives its photograph. It replaces
`mediaKeys`, which lived in `vehicle-images.service.ts` while only vehicle
images had derivatives.

## `apps/api/src/platform/media/uploaded.ts`

### `export async function recordMediaUploaded(tx, { mediaId, dealerId, actor, traceId })`

Announces, in the committing transaction, that an image is now `READY`: a
`MediaUploaded` outbox event. The media module turns it into a `media.process`
job (`subscribe` in `media.processor.ts`).

**Why an event and not a call after the commit.** #373 queued the job after
the transaction with an injected `processImage`, and swallowed a queue failure
so the upload still succeeded. That was right about the upload and lossy about
the resize: a queue hiccup, or a process stopping between commit and send, left
a `READY` image with no derivatives and nothing to retry it. The outbox row
commits or rolls back with the upload, and the publisher retries a failed
publish up to `MAX_ATTEMPTS`, the same guarantee storage cleanup and every
email already have.

It is a fact, not a command, which is also why it lives here rather than on the
media facade: the facade test forbids any pipeline operation crossing the
module boundary, and `vehicle-images` and `dealers` say what happened without
being able to say what should be done about it.
