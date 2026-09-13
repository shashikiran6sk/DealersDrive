import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

import { env } from '../../config/env.js';

/**
 * The one PrismaClient for the process.
 *
 * Rule 2 (ARCHITECTURE §5.5): only `*.repository.ts` imports this module.
 * `grep -rn "platform/db/prisma" src/modules | grep -v repository` should
 * return nothing, and ESLint enforces it.
 */
export type Db = PrismaClient;

/**
 * A transaction handle. Repositories accept it so a service can compose several
 * writes — a credit movement and the state change it pays for — into one
 * transaction (§26.2).
 *
 * Mirrors Prisma's own `ITXClientDenyList` (the set a `$transaction` callback
 * client omits). Prisma 7 dropped `$transaction` from that list — nested
 * transactions are allowed now — so it must not be omitted here either, or
 * this type silently stops matching `Prisma.TransactionClient` and every
 * helper that accepts either (e.g. `roles.ts`) fails to typecheck.
 */
export type Tx = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$use' | '$extends'>;

export function createPrisma(): PrismaClient {
  // Prisma 7 dropped the `datasources` override in favour of a driver
  // adapter — the client no longer opens the connection itself, `pg` does.
  const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });
  return new PrismaClient({
    adapter,
    log: env.isDevelopment ? ['warn', 'error'] : ['error'],
    // See `DB_TRANSACTION_TIMEOUT_MS` in config/env.ts. Prisma's 5s default is
    // shorter than a settlement takes against an out-of-region database, and
    // the transaction that loses the race is a credit purchase.
    transactionOptions: {
      timeout: env.DB_TRANSACTION_TIMEOUT_MS,
      maxWait: env.DB_TRANSACTION_MAX_WAIT_MS,
    },
  });
}

/**
 * BigInt has no JSON representation. Every money value in this system is
 * BigInt paise and every one of them is small enough for a JSON number
 * (API-SPEC §0.4), so the conversion is safe — but it must be deliberate,
 * which is why mappers call `Number()` explicitly rather than relying on this.
 * This exists only so an accidental serialisation throws a clear error path
 * instead of "Do not know how to serialize a BigInt" from deep inside Express.
 */
export function installBigIntJson(): void {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
  (BigInt.prototype as any).toJSON = function toJSON(this: bigint): number {
    return Number(this);
  };
}
