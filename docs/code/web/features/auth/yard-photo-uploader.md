# web / features/auth/yard-photo-uploader

Parent: [web](../../../README.md)

The notes below belonged to the files named under each heading. Each heading is the
declaration the note sat above.

## `apps/web/src/features/auth/yard-photo-uploader/yard-photo-uploader.tsx`

### `export function YardPhotoUploader({ photo }: { photo: YardPhotoDto })`

The yard photograph — the hero of the dealership's public portfolio.

Same presign → PUT → commit pipeline as the KYC documents beside it, and a
deliberately different presentation: a document row is a checklist tick, this
is the image a buyer sees first, so the dealer is shown it at a size where
they can tell whether it is any good.

The instruction text is doing real work. A dealer asked for "a photo" sends a
phone snap of a car; a dealer told what the image is _for_ sends the shot of
the entrance they already have. The cost of the second sentence is one line;
the cost of not having it is a moderator rejecting the application.

### `{/* eslint-disable-next-line @next/next/no-img-element */}`

A plain <img>, not next/image. The source is a short-lived signed URL
against object storage — it changes on every render and the optimiser
has nothing stable to cache.
