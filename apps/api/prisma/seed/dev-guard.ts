import { env } from '../../src/config/env.js';

/**
 * Loopback only, unless the operator says otherwise in words.
 *
 * Shared by the two dev seeds. They write a hundred and twenty invented
 * dealerships and three hundred invented cars; pointed at a shared or hosted
 * database that is not a mistake you notice — it is rows a colleague then has
 * to find and delete by hand, and on a public marketplace it is businesses and
 * cars that do not exist. So the host in `DATABASE_URL` has to be a loopback
 * address, and overriding that has to be typed out in full:
 *
 *     ALLOW_REMOTE_DEV_SEED=yes pnpm db:seed:dev
 */
export function assertLocalDatabase(what: string): void {
  if (process.env.ALLOW_REMOTE_DEV_SEED === 'yes') {
    console.warn(`ALLOW_REMOTE_DEV_SEED=yes — writing ${what} to a non-local database.`);
    return;
  }

  if (env.isProduction) {
    throw new Error(`The dev seed refuses to write ${what} with NODE_ENV=production.`);
  }

  const host = new URL(env.DATABASE_URL).hostname;
  const isLocal = host === 'localhost' || host === '127.0.0.1' || host === '::1';

  if (!isLocal) {
    throw new Error(
      `DATABASE_URL points at "${host}", not at localhost.\n` +
        `These are invented ${what} — they do not belong in a shared database.\n` +
        'If you meant it: ALLOW_REMOTE_DEV_SEED=yes pnpm db:seed:dev',
    );
  }
}
