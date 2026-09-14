# web / app/api/dealer/yard-photo

Parent: [web](../../../../README.md)

The notes below belonged to the files named under each heading. Each heading is the
declaration the note sat above.

## `apps/web/src/app/api/dealer/yard-photo/route.ts`

### `export async function DELETE(): Promise<NextResponse>`

BFF for removing the yard photograph. The dealership reads as incomplete again.

### `const session = await currentSession()`

A removed photograph has to disappear from the public pages as promptly

### `const session = await currentSession()`

as a new one appears there — more so, if it was removed _because_ it

### `const session = await currentSession()`

should not have been published.
