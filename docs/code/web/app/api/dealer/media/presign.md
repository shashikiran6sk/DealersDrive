# web / app/api/dealer/media/presign

Parent: [web](../../../../../README.md)

The notes below belonged to the files named under each heading. Each heading is the
declaration the note sat above.

## `apps/web/src/app/api/dealer/media/presign/route.ts`

### `export async function POST(request: Request): Promise<NextResponse>`

BFF for C14 presign.

The upload itself goes **direct from the browser to object storage** — that
is the whole point of the presigned PUT, and it is why 10MB photos never
touch this server (ARCHITECTURE §12.1). Only the signing call is proxied,
because it needs the API base URL and the session.
