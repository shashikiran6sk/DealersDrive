# api / modules/health/routes

Parent: [api](../../../README.md)

The notes below belonged to the files named under each heading. Each heading is the
declaration the note sat above.

## `apps/api/src/modules/health/routes/get-ready.ts`

### `if (isDraining())`

Draining is answered before anything is probed. The dependencies are

### `if (isDraining())`

very likely still fine; that is not the question being asked.

### `probe(() => container.cache.ping())`

The rate limiter reads through this on every public request, so a

### `probe(() => container.cache.ping())`

cache that is down is a real degradation even though the limiter

### `probe(() => container.cache.ping())`

itself fails open.

### `version: env.GIT_SHA`

The deployed commit. A deploy pipeline has no other way to tell

### `version: env.GIT_SHA`

"the new image is serving" from "the old one is still serving and

### `version: env.GIT_SHA`

answering exactly as well" — both are 200s (§20.3).

## `apps/api/src/modules/health/routes/uptime.ts`

### `export async function probe(check: () => Promise<unknown>): Promise<string>`

Runs one dependency probe and reduces it to `ok` / `down`.
