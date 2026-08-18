import type { PrismaClient } from '@prisma/client';
import type { Logger } from 'pino';

import { env, type Env } from './config/env.js';
import { createAuthMiddleware } from './middleware/auth.js';
import { createAdminService, type AdminService } from './modules/admin/admin.service.js';
import { createAuthService, type AuthService } from './modules/auth/auth.service.js';
import { createCookieSessionResolver } from './modules/auth/cookie-session.adapter.js';
import { createDevSessionResolver } from './modules/auth/dev-session.adapter.js';
import { createGoogleOAuthProvider } from './modules/auth/google.provider.js';
import type { OAuthProvider } from './modules/auth/oauth.port.js';
import { createSessionService, type SessionService } from './modules/auth/session.service.js';
import type { SessionResolver } from './modules/auth/session.port.js';
import { createBillingService, type BillingService } from './modules/billing/billing.service.js';
import { createCatalogRepository } from './modules/catalog/catalog.repository.js';
import { createCatalogService, type CatalogService } from './modules/catalog/catalog.service.js';
import { createDealersPublicService, type DealersPublicService } from './modules/dealers/dealers.public.service.js';
import { createDealersRepository } from './modules/dealers/dealers.repository.js';
import { createDealersService, type DealersService } from './modules/dealers/dealers.service.js';
import { createEnquiriesRepository } from './modules/enquiries/enquiries.repository.js';
import { createEnquiriesService, type EnquiriesService } from './modules/enquiries/enquiries.service.js';
import { createMediaService, type MediaService } from './modules/media/media.service.js';
import { createSearchRepository, type SearchRepository } from './modules/search/search.repository.js';
import { createSearchService, type SearchService } from './modules/search/search.service.js';
import { createVehiclesRepository } from './modules/vehicles/vehicles.repository.js';
import { createVehiclesService, type VehiclesService } from './modules/vehicles/vehicles.service.js';
import { createAuditService } from './platform/audit/audit.service.js';
import { createPlatformConfig, type PlatformConfigService } from './platform/config/platform-config.js';
import { createPrisma, installBigIntJson } from './platform/db/prisma.js';
import { createEventBus, type EventBus } from './platform/events/bus.js';
import { createOutboxPublisher, type OutboxPublisher } from './platform/events/outbox-publisher.js';
import { registerHandlers, registerSchedules } from './platform/jobs/handlers.js';
import { createQueue, type Queue } from './platform/jobs/queue.js';
import { createMsg91Sms } from './platform/notify/msg91.adapter.js';
import { createConsoleMailer, createConsoleSms } from './platform/notify/notify.port.js';
import { createDevelopmentPaymentProvider } from './platform/payments/development.provider.js';
import type { PaymentProvider } from './platform/payments/payment.port.js';
import { createStorage } from './platform/storage/factory.js';
import { ensureBucket } from './platform/storage/s3.adapter.js';
import type { StoragePort } from './platform/storage/storage.port.js';
import { logger } from './platform/telemetry/logger.js';

/**
 * The composition root — this replaces DI (ARCHITECTURE §5.3).
 *
 * Every dependency is constructed here, by hand, in dependency order, and
 * passed down as plain arguments. Explicit, greppable, and trivially testable:
 * pass fakes in, get a module out. Every provider seam is visible in one place,
 * and each is chosen by configuration rather than by code:
 *
 *   sessions  — `CookieSessionResolver`, or the dev identity under AUTH_MODE=dev
 *   oauth     — Google; a fake is injected by the sign-in tests
 *   storage   — local disk · MinIO · R2, by STORAGE_DRIVER
 *   sms       — console · MSG91, by SMS_DRIVER
 *   payments  — `createDevelopmentPaymentProvider` today, Razorpay later
 *
 * None of those choices reaches a module: they are all made here.
 */
export interface Container {
  readonly env: Env;
  readonly logger: Logger;
  readonly prisma: PrismaClient;
  readonly queue: Queue;
  readonly bus: EventBus;
  readonly outbox: OutboxPublisher;
  readonly storage: StoragePort;
  readonly payments: PaymentProvider;
  readonly config: PlatformConfigService;
  readonly sessions: SessionResolver;
  readonly sessionStore: SessionService;
  readonly oauth: OAuthProvider;
  /** The guard chain. `auth` below is the module that issues the sessions. */
  readonly guards: ReturnType<typeof createAuthMiddleware>;
  readonly auth: AuthService;
  readonly search: SearchService;
  readonly searchRepo: SearchRepository;
  readonly catalog: CatalogService;
  readonly dealers: DealersService;
  readonly dealersPublic: DealersPublicService;
  readonly vehicles: VehiclesService;
  readonly media: MediaService;
  readonly enquiries: EnquiriesService;
  readonly billing: BillingService;
  readonly admin: AdminService;
}

export interface ContainerOverrides {
  prisma?: PrismaClient;
  sessions?: SessionResolver;
  /** The seam the sign-in tests replace, so no test ever talks to Google. */
  oauth?: OAuthProvider;
  payments?: PaymentProvider;
  queue?: Queue;
  storage?: StoragePort;
}

export async function buildContainer(overrides: ContainerOverrides = {}): Promise<Container> {
  installBigIntJson();

  const prisma = overrides.prisma ?? createPrisma();
  const queue = overrides.queue ?? createQueue();
  const bus = createEventBus();
  const outbox = createOutboxPublisher(prisma, bus);
  const storage = overrides.storage ?? createStorage();
  const payments = overrides.payments ?? createDevelopmentPaymentProvider();
  const config = createPlatformConfig(prisma);
  const audit = createAuditService(prisma);
  const mailer = createConsoleMailer();
  const sms = env.SMS_DRIVER === 'msg91' ? createMsg91Sms() : createConsoleSms();

  const sessionStore = createSessionService(prisma);
  const oauth = overrides.oauth ?? createGoogleOAuthProvider();
  const sessions = overrides.sessions ?? createResolver(prisma, sessionStore);
  const guards = createAuthMiddleware(sessions);

  const catalogRepo = createCatalogRepository(prisma);
  const dealersRepo = createDealersRepository(prisma);
  const vehiclesRepo = createVehiclesRepository(prisma);
  const enquiriesRepo = createEnquiriesRepository(prisma);
  const searchRepo = createSearchRepository(prisma);

  const catalog = createCatalogService({ repo: catalogRepo, search: searchRepo, config });
  const search = createSearchService({
    repo: searchRepo,
    catalog: catalogRepo,
    dealers: dealersRepo,
    vehicles: vehiclesRepo,
  });
  const dealersPublic = createDealersPublicService({ repo: dealersRepo, search: searchRepo });
  const media = createMediaService({ prisma, storage, queue, config });
  const enquiries = createEnquiriesService({
    prisma,
    repo: enquiriesRepo,
    dealers: dealersRepo,
    search: searchRepo,
    config,
  });
  const dealers = createDealersService({
    prisma,
    repo: dealersRepo,
    enquiries: enquiriesRepo,
    storage,
  });
  const vehicles = createVehiclesService({ prisma, repo: vehiclesRepo, dealers: dealersRepo, config });
  const billing = createBillingService({ prisma, dealers: dealersRepo, payments, config });
  const admin = createAdminService({ prisma, audit, config, storage });
  const auth = createAuthService({ prisma, sessions: sessionStore, oauth, dealers, audit });

  await registerHandlers({ prisma, queue, bus, search: searchRepo, media, mailer, sms });

  return {
    env,
    logger,
    prisma,
    queue,
    bus,
    outbox,
    storage,
    payments,
    config,
    sessions,
    sessionStore,
    oauth,
    guards,
    auth,
    search,
    searchRepo,
    catalog,
    dealers,
    dealersPublic,
    vehicles,
    media,
    enquiries,
    billing,
    admin,
  };
}

/**
 * `AUTH_MODE=dev` is a documented escape hatch for a developer who has not
 * registered a Google OAuth client yet, and it is loud on purpose: it replaces
 * identity verification with a server-configured identity. `env.ts` refuses it
 * in production, so this branch cannot be reached there.
 */
function createResolver(prisma: PrismaClient, sessionStore: SessionService): SessionResolver {
  if (env.AUTH_MODE === 'dev') {
    logger.warn(
      { devDealer: env.DEV_DEALER_SLUG },
      'AUTH_MODE=dev — sign-in is bypassed and every request acts as the configured dealer',
    );
    return createDevSessionResolver(prisma);
  }
  return createCookieSessionResolver(prisma, sessionStore);
}

/** Starts the background machinery. Not called by tests, which drain inline. */
export async function startBackground(container: Container): Promise<void> {
  // A fresh MinIO volume has no bucket, and the first photo upload should not be
  // the thing that discovers that.
  if (env.STORAGE_DRIVER !== 'local') {
    await ensureBucket();
    logger.info({ bucket: env.S3_BUCKET, endpoint: env.S3_ENDPOINT }, 'object storage ready');
  }

  if (!env.JOBS_ENABLED) return;

  await container.queue.start();
  if (env.WORKER_INLINE || env.WORKER) {
    await registerSchedules(container.queue);
  }
  container.outbox.start();
}

/** Releases everything the container holds open. Called on SIGTERM. */
export async function closeContainer(container: Container): Promise<void> {
  container.outbox.stop();
  try {
    await container.queue.stop();
  } catch (error) {
    logger.warn({ err: error }, 'queue stop failed');
  }
  await container.prisma.$disconnect();
}
