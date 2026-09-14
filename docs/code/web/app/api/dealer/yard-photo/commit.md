# web / app/api/dealer/yard-photo/commit

Parent: [web](../../../../../README.md)

The notes below belonged to the files named under each heading. Each heading is the
declaration the note sat above.

## `apps/web/src/app/api/dealer/yard-photo/commit/route.ts`

### `export async function POST(request: Request): Promise<NextResponse>`

BFF for the yard-photograph commit — the step that adopts an uploaded object.

### `await revalidateForCurrentDealer()`

The photograph is the first thing a buyer sees of a dealership — the
directory card's cover and the portfolio's hero — so a new one has to
appear rather than wait out a ten-minute window (`lib/cache-tags.ts`).

The slug costs a `GET /v1/auth/me` because `YardPhotoDto` has no reason
to carry one. That is a fair price on a path that has just uploaded an
image, and it is not on any read.

### `async function revalidateForCurrentDealer(): Promise<void>`

Clears this dealership's public pages, whoever it is.

A route handler has the session cookie but not the dealership's slug, and
neither the commit nor the delete answers with one. A signed-out caller never
reaches here — the API would have refused first — so a null session means
there is nothing to clear.
