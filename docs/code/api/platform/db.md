# api / platform/db

Parent: [api](../../README.md)

The notes below belonged to the files named under each heading. Each heading is the
declaration the note sat above.

## `apps/api/src/platform/db/prisma.ts`

### `export type Db = PrismaClient`

The one PrismaClient for the process.

**Bounded, so nothing waits forever (R98).** The pool used to be built from the
connection string alone, which leaves `pg`'s defaults: acquiring a connection
waits indefinitely, a statement may run indefinitely, and a transaction left
open holds its locks indefinitely. The production recording showed requests
pending for 25 and 43 seconds — chains of the web tier's 8-second timeouts — and
nothing on this side would ever have given up. Four bounds, each an env var:

| Variable                            | Default | Bounds                                              |
| ----------------------------------- | ------- | --------------------------------------------------- |
| `DB_POOL_MAX`                       | 10      | connections per process (pg's own default)          |
| `DB_CONNECT_TIMEOUT_MS`             | 5000    | waiting for a pooled connection or a new one        |
| `DB_STATEMENT_TIMEOUT_MS`           | 15000   | any one statement, lock waits included              |
| `DB_IDLE_IN_TRANSACTION_TIMEOUT_MS` | 30000   | a transaction left open and idle, holding its locks |

`keepAlive` is on, so a connection silently dropped by a NAT or a failover is
noticed rather than hung on. A request that hits a bound fails fast with a 5xx
and a log line carrying its `traceId`, instead of looking like a frozen page.
The interactive transaction's own `timeout` (20s) and `maxWait` (10s) are
unchanged. Seeds build their own client and are not bounded.

Rule 2 (ARCHITECTURE §5.5): only `*.repository.ts` imports this module.
`grep -rn "platform/db/prisma" src/modules | grep -v repository` should
return nothing, and ESLint enforces it.

### `export type Tx = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$use' | '$extends'>`

A transaction handle. Repositories accept it so a service can compose several
writes — a credit movement and the state change it pays for — into one
transaction (§26.2).

Mirrors Prisma's own `ITXClientDenyList` (the set a `$transaction` callback
client omits). Prisma 7 dropped `$transaction` from that list — nested
transactions are allowed now — so it must not be omitted here either, or
this type silently stops matching `Prisma.TransactionClient` and every
helper that accepts either (e.g. `roles.ts`) fails to typecheck.

### `const adapter = new PrismaPg({ connectionString: env.DATABASE_URL })`

Prisma 7 dropped the `datasources` override in favour of a driver

### `const adapter = new PrismaPg({ connectionString: env.DATABASE_URL })`

adapter — the client no longer opens the connection itself, `pg` does.

### `transactionOptions:`

See `DB_TRANSACTION_TIMEOUT_MS` in config/env.ts. Prisma's 5s default is

### `transactionOptions:`

shorter than a settlement takes against an out-of-region database, and

### `transactionOptions:`

the transaction that loses the race is a credit purchase.

### `return client.$extends(`

One extension at the composition root covers model calls, raw operations
and transaction clients. Only the bounded model and operation names become
labels; args and SQL are never recorded.

Prisma's extended client is structurally compatible at runtime, but its
generated type deliberately omits a few extension-building internals. The
rest of this application accepts PrismaClient as its stable port, so the
cast keeps instrumentation from leaking through every service signature.

### `declare global`

BigInt has no JSON representation. Every money value in this system is
BigInt paise and every one of them is small enough for a JSON number
(API-SPEC §0.4), so the conversion is safe — but it must be deliberate,
which is why mappers call `Number()` explicitly rather than relying on this.
This exists only so an accidental serialisation throws a clear error path
instead of "Do not know how to serialize a BigInt" from deep inside Express.

## `apps/api/src/platform/db/tenant-tx.ts`

### `export async function withTenant<T>`

Runs a unit of work with the tenant stamped on the transaction.

`SET LOCAL app.dealer_id` is what the row-level-security policies in
`prisma/rls.sql` read. Those policies are the fourth backstop behind
session-derived context, repository signatures and tests (ARCHITECTURE §7);
they are applied separately because creating the two database roles needs
privileges a migration should not assume. The `SET LOCAL` is issued
unconditionally so switching RLS on is a database change, not a code change.

### `export async function withTransaction<T>`

Plain transaction for platform work that legitimately spans tenants.

### `function assertUuid(value: string): string`

`SET LOCAL` cannot be parameterised, so the value is interpolated — and is
therefore checked against the UUID grammar first. The id always comes from
the session, never from a client, but a guard that costs one regex is worth
having on the one line in the codebase that concatenates SQL.
