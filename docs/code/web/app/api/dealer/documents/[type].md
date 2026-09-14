# web / app/api/dealer/documents/[type]

Parent: [web](../../../../../README.md)

The notes below belonged to the files named under each heading. Each heading is the
declaration the note sat above.

## `apps/web/src/app/api/dealer/documents/[type]/route.ts`

### `export async function DELETE`

BFF for C5 delete — the half of "replace" that removes what was there.

A dealer who uploaded the wrong scan of their PAN card needs a way to take it
back, and "upload a different one over the top" is not that: it leaves the
first file in storage. The API deletes both the row's contents and the
object; this proxies it so the session, not a client-supplied id, decides
whose document is being removed (Rule 1).
