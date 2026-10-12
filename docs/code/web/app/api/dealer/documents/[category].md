# web / app/api/dealer/documents/[category]

Parent: [web](../../../../../README.md)

The notes below belonged to the files named under each heading. Each heading is the
declaration the note sat above.

## `apps/web/src/app/api/dealer/documents/[category]/route.ts`

### `export async function DELETE`

BFF for C5 delete — the half of "replace" that removes what was there.

A dealer who uploaded the wrong scan of their PAN card needs a way to take it
back, and "upload a different one over the top" is not that: it leaves the
first file in storage. The API deletes both the row's contents and the
object; this proxies it so the session, not a client-supplied id, decides
whose document is being removed (Rule 1).

### `const parsed = DocCategoryParam.safeParse(await params)`

The slot is addressed by **category**, not by document type (#299). A
dealership holds one document per category, of whichever type it chose, so
"remove my Business Identity Proof" is the question that has one answer —
"remove my Udyam certificate" would be a second key for the same row. The
param is parsed with the same `DocCategoryParam` the API validates with, so
`SUPPORTING` (the legacy slot) and anything unknown is a 400 here rather than
a round trip.
