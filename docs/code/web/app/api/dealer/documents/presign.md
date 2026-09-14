# web / app/api/dealer/documents/presign

Parent: [web](../../../../../README.md)

The notes below belonged to the files named under each heading. Each heading is the
declaration the note sat above.

## `apps/web/src/app/api/dealer/documents/presign/route.ts`

### `export async function POST(request: Request): Promise<NextResponse>`

BFF for C5 document presign.

Same shape as the media presign beside it, and for the same reason: the file
goes **straight from the browser to storage**, and only the signing call is
proxied — because it needs the API base URL and the session, neither of which
belongs in a browser bundle (Rule 9).
