# web / app/(admin)

Parent: [web](../../README.md)

The notes below belonged to the files named under each heading. Each heading is the
declaration the note sat above.

## `apps/web/src/app/(admin)/error.tsx`

### `export default function AdminError(`

The admin boundary. Same contract as the dealer console — a neutral message
plus the `digest` to correlate with the server log — because an operator
reading a Prisma stack in the moderation queue is still an operator who
cannot do anything with it. The stack is in the log, addressed by traceId.
