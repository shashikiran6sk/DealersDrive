# web / app/api/dealer/yard-photo/presign

Parent: [web](../../../../../README.md)

The notes below belonged to the files named under each heading. Each heading is the
declaration the note sat above.

## `apps/web/src/app/api/dealer/yard-photo/presign/route.ts`

### `export async function POST(request: Request): Promise<NextResponse>`

BFF for the yard photograph presign.

Same shape as the two presigns beside it, and for the same reason: the bytes
go **straight from the browser to storage**, and only the signing call is
proxied — it needs the API base URL and the session, neither of which belongs
in a browser bundle (Rule 9).
