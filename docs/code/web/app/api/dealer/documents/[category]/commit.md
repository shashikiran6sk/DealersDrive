# web / app/api/dealer/documents/[category]/commit

Parent: [web](../../../../../../README.md)

The notes below belonged to the files named under each heading. Each heading is the
declaration the note sat above.

## `apps/web/src/app/api/dealer/documents/[category]/commit/route.ts`

### `export async function POST`

BFF for C5 commit — the step that turns an uploaded object into a record.

The commit is addressed by category, like the delete beside it: the type was
fixed at presign, where `DocumentPresignInput` checked it belongs to the
category, and the commit only adopts the object into that slot.
