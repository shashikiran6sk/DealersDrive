# api / platform/storage

Parent: [api](../../README.md)

The notes below belonged to the files named under each heading. Each heading is the
declaration the note sat above.

## `apps/api/src/platform/storage/factory.ts`

### `export function createStorage(): StoragePort`

The storage provider, chosen by one variable.

It lives here rather than in `container.ts` because the seed needs the same
decision: a seeded photo has to land wherever the API will look for it, and
a seed that always wrote to local disk would leave a MinIO-backed developer
with a catalogue of broken images (§12.1).

local — the filesystem. No container needed; what the test suite uses.
minio — S3-compatible, on localhost:9000.
r2 — S3-compatible, at Cloudflare. Production.

## `apps/api/src/platform/storage/local.adapter.ts`

### `export interface LocalStorageSignature`

R2 stood in with the local filesystem.

The point is that the _contract_ is identical: the client receives a signed
URL with an expiry and content conditions, PUTs the bytes there without the
API in the path, and then commits. Only the host that terminates the PUT
changes when `STORAGE_DRIVER=r2` — which is the whole reason `StoragePort`
exists (ARCHITECTURE §12.1).

### `presignPut(`

Not `async`: signing against local disk is arithmetic. The port is

### `presignPut(`

promise-returning because signing against S3 is not.

### `export function pathFor(key: string): string`

`..` in a storage key would escape the root. Keys are always generated
server-side, but the one function that turns a key into a filesystem path is
the wrong place to assume that.

## `apps/api/src/platform/storage/s3.adapter.ts`

### `export function createS3Storage(client: S3Client = createS3Client()): StoragePort`

One adapter, two deployments: MinIO on a laptop, Cloudflare R2 in production.

They are the same code because they are the same protocol — S3 with SigV4 —
and the only things that differ are `S3_ENDPOINT` and the two keys. That is
the entire content of the claim "changing provider is configuration": there
is no `if (isR2)` in this file, and there is no second implementation to keep
in step with this one.

R2 ignores regions but SigV4 requires one in the signature, which is why
`auto` is the documented value for both.

### `async presignPut(`

A presigned PUT the browser performs directly — the API never sees the
bytes, which is what keeps a 10 MB photo off the Node process (§12.1).

`content-type` and `content-length` are _signed_ headers, not hints: the
signature covers their values, so a client that asks to upload 400 KB of
JPEG and then sends 40 MB of something else is rejected by the object
store before a byte is stored. That check is the whole reason the commit
step can trust what it finds.

### `'Content-Length': String(contentLength)`

The browser sets this itself from the body it sends; naming it here

### `'Content-Length': String(contentLength)`

tells the client what the signature expects, and a mismatch fails

### `'Content-Length': String(contentLength)`

at the object store rather than silently storing the wrong length.

### `publicUrl(key)`

Delivery goes through `MEDIA_BASE_URL`, not through the bucket.

The bucket stays private in every environment: locally the API serves the
bytes, in production a Cloudflare zone sits in front of R2. Either way the
URL a page renders is addressed by media id and width, so the bucket
layout can change without invalidating a single cached page.

### `signedReadUrl(key, expiresInSeconds)`

The only way a KYC document is ever served. Minutes, not hours.

### `accessKeyId: env.S3_ACCESS_KEY_ID ?? ''`

Guaranteed present: `env.ts` refuses to start with a non-local storage

### `accessKeyId: env.S3_ACCESS_KEY_ID ?? ''`

driver and no keys, so the empty string is unreachable and exists only

### `accessKeyId: env.S3_ACCESS_KEY_ID ?? ''`

to satisfy the type.

### `export async function ensureBucket(client: S3Client = createS3Client()): Promise<void>`

The bucket, created if this is a fresh MinIO volume.

Called once at boot rather than per request. R2 buckets are created in the
Cloudflare dashboard and this is a no-op against them, but a developer who
has just run `docker compose up` should not have to open a console to upload
their first photo.

### `function isNotFound(error: unknown): boolean`

S3, MinIO and R2 all answer 404 here; only the error name varies.

## `apps/api/src/platform/storage/storage.port.ts`

### `export interface PresignedUpload`

The seam between the application and object storage.

`LocalDiskStorage`, MinIO and Cloudflare R2 all implement it. No S3 concept
leaks through this interface — no bucket, no region, no SigV4 — which is what
makes the swap a one-line provider change in the container (§5.1) and an
environment variable everywhere else.

`presignPut` and `signedReadUrl` are asynchronous because signing against a
real object store is: the local adapter is the only implementation that could
answer synchronously, and shaping the port around the exception would have
cost every caller a rewrite the day R2 arrived.

### `presignPut(input:`

A URL the browser PUTs the bytes to directly. The API never touches image
bytes on the upload path. Content-type **and** content-length are baked
into the signature, so a client cannot upload something other than what it
declared (§12.1).

### `head(key: string): Promise<StoredObject | null>`

HEAD the object after commit — verify what actually landed.

### `publicUrl(key: string): string`

Public delivery URL. Never called for KYC documents — they have no route.

### `signedReadUrl(key: string, expiresInSeconds: number): Promise<string>`

Short-lived signed read. The only way a KYC document is ever served, and
every issue of one is audit-logged (§26.6).
