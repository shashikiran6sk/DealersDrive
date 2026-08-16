import type { Logger } from 'pino';

import { env, type Env } from './config/env.js';
import { logger } from './platform/telemetry/logger.js';

/**
 * The composition root — this replaces DI (MVP-SCOPE §4.2).
 *
 * Every dependency in the system is constructed here, by hand, in dependency
 * order, and passed down as plain arguments. Explicit, greppable, and trivially
 * testable: pass fakes in, get a module out. No decorators, no reflection, no
 * framework magic to debug at 2am.
 *
 * Nothing is wired yet. The shape it grows into:
 *
 *   export function buildContainer(prisma: PrismaClient) {
 *     const storage = createR2Storage(env);
 *     const mailer  = createResendMailer(env);
 *     const queue   = createQueue(env.DATABASE_URL);
 *     const events  = createEventBus(queue);
 *
 *     const auth     = createAuthModule({ prisma, mailer, sms, audit });
 *     const vehicles = createVehiclesModule({ prisma, catalog: catalog.facade, events });
 *     ...
 *     return { auth, vehicles, ..., queue, events };
 *   }
 *
 * Each module returns `{ router, facade }`: the router is mounted in routes.ts,
 * the facade is the only thing other modules are allowed to import.
 */
export interface Container {
  readonly env: Env;
  readonly logger: Logger;
}

export function buildContainer(): Container {
  return {
    env,
    logger,
  };
}

/**
 * Releases anything the container holds open. Called on SIGTERM before the
 * process exits — Day 3 closes the Prisma pool here, Day 21 stops pg-boss.
 */
export async function closeContainer(_container: Container): Promise<void> {
  await Promise.resolve();
}
