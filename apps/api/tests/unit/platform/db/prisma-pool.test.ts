import { describe, expect, it, vi } from 'vitest';

/**
 * R98 — the pool `createPrisma` builds is bounded.
 *
 * The connection string alone leaves pg's defaults: wait for a connection
 * forever, run a statement forever, hold an idle transaction's locks forever.
 * This pins that every bound from `env` reaches the pool, and that the
 * connection string is still passed through untouched — TLS
 * (`sslmode=verify-full`, `sslrootcert`) is configured there in production.
 */
const adapterConfigs = vi.hoisted(() => [] as unknown[]);

vi.mock('@prisma/adapter-pg', () => ({
  PrismaPg: class {
    constructor(config: unknown) {
      adapterConfigs.push(config);
    }
  },
}));

vi.mock('@prisma/client', () => ({
  PrismaClient: class {
    $extends() {
      return {};
    }
  },
}));

const { createPrisma } = await import('../../../../src/platform/db/prisma.js');
const { env } = await import('../../../../src/config/env.js');

describe('createPrisma — the pool', () => {
  it('passes the connection string through and bounds acquire, statements and idle transactions', () => {
    createPrisma();

    expect(adapterConfigs.at(-1)).toEqual({
      connectionString: env.DATABASE_URL,
      max: env.DB_POOL_MAX,
      connectionTimeoutMillis: env.DB_CONNECT_TIMEOUT_MS,
      statement_timeout: env.DB_STATEMENT_TIMEOUT_MS,
      idle_in_transaction_session_timeout: env.DB_IDLE_IN_TRANSACTION_TIMEOUT_MS,
      keepAlive: true,
    });
  });
});
