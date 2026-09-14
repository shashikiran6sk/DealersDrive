# web / app/api/dealer/media/[id]

Parent: [web](../../../../../README.md)

The notes below belonged to the files named under each heading. Each heading is the
declaration the note sat above.

## `apps/web/src/app/api/dealer/media/[id]/route.ts`

### `export async function POST`

BFF for C14 commit and poll.

`POST` commits an uploaded object at a position; `GET` is the poll the
uploader runs until processing reports READY or FAILED. Both are proxied so
the API base URL stays server-side (Rule 9) and the session — not a
client-supplied dealer id — decides whose media this is (Rule 1).
