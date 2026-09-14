import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

import { env } from '../../config/env.js';
import { instrumentDbOperation } from '../telemetry/metrics.js';

export type Db = PrismaClient;

export type Tx = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$use' | '$extends'>;

export function createPrisma(): PrismaClient {
  const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });
  const client = new PrismaClient({
    adapter,
    log: env.isDevelopment ? ['warn', 'error'] : ['error'],
    transactionOptions: {
      timeout: env.DB_TRANSACTION_TIMEOUT_MS,
      maxWait: env.DB_TRANSACTION_MAX_WAIT_MS,
    },
  });

  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- the extended client re-types the delegates
  return client.$extends({
    name: 'dealers-drive-observability',
    query: {
      $allOperations({ model, operation, query, args }) {
        return instrumentDbOperation(model, operation, () => query(args));
      },
    },
  }) as unknown as PrismaClient;
}

declare global {
  interface BigInt {
    toJSON(): number;
  }
}

export function installBigIntJson(): void {
  BigInt.prototype.toJSON = function toJSON(this: bigint): number {
    return Number(this);
  };
}
