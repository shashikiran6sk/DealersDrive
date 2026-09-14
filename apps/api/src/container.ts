import type { PrismaClient } from '@prisma/client';

import { env, type Env } from './config/env.js';
import { createAuthMiddleware } from './middleware/auth.js';
import { createRateLimiter, type RateLimiter } from './middleware/rate-limit.js';
import { createAdminService, type AdminService } from './modules/admin/admin.service.js';
import { createAuthService, type AuthService } from './modules/auth/auth.service.js';
import { createCookieSessionResolver } from './modules/auth/cookie-session.adapter.js';
import { createConfigService, type ConfigService } from './modules/config/config.service.js';
import { createDevSessionResolver } from './modules/auth/dev-session.adapter.js';
import { createGoogleOAuthProvider } from './modules/auth/google.provider.js';
import type { OAuthProvider } from './modules/auth/oauth.port.js';
import type { SessionResolver } from './modules/auth/session.port.js';
import { createPhoneService, type PhoneService } from './modules/auth/phone.service.js';
import { createSessionService, type SessionService } from './modules/auth/session.service.js';
import {
  createDealersPublicService,
  noInventoryYet,
  type DealersPublicService,
} from './modules/dealers/dealers.public.service.js';
import { createDealersRepository } from './modules/dealers/dealers.repository.js';
import { createMediaService, type MediaService } from './modules/media/media.service.js';
import { createDealersService, type DealersService } from './modules/dealers/dealers.service.js';
import { createAuditService } from './platform/audit/audit.service.js';
import {
  createPlatformConfig,
  type PlatformConfigService,
} from './platform/config/platform-config.js';
import type { CachePort } from './platform/cache/cache.port.js';
import { createCache } from './platform/cache/factory.js';
import { createPrisma, installBigIntJson } from './platform/db/prisma.js';
import { createEventBus, type EventBus } from './platform/events/bus.js';
import { createOutboxPublisher, type OutboxPublisher } from './platform/events/outbox-publisher.js';
import { createQueue, type Queue } from './platform/jobs/queue.js';
import { createMapsResolver, type MapsPort } from './platform/maps/maps-link.js';
import { createPhoneOtp } from './platform/phone-otp/factory.js';
import type { PhoneOtpPort } from './platform/phone-otp/phone-otp.port.js';
import { createMailer } from './platform/mail/factory.js';
import type { MailerPort } from './platform/mail/mail.port.js';
import {
  createNotificationsService,
  type NotificationsService,
} from './modules/notifications/notifications.service.js';
import { createStorage } from './platform/storage/factory.js';
import { ensureBucket } from './platform/storage/s3.adapter.js';
import type { StoragePort } from './platform/storage/storage.port.js';
import { logger } from './platform/telemetry/logger.js';

export interface Container {
  readonly env: Env;
  readonly prisma: PrismaClient;
  readonly cache: CachePort;
  readonly rateLimit: RateLimiter;
  readonly config: PlatformConfigService;
  readonly queue: Queue;
  readonly bus: EventBus;
  readonly outbox: OutboxPublisher;
  readonly storage: StoragePort;
  readonly maps: MapsPort;
  readonly mailer: MailerPort;
  readonly notifications: NotificationsService;
  readonly sessions: SessionResolver;
  readonly sessionStore: SessionService;
  readonly oauth: OAuthProvider;
  readonly guards: ReturnType<typeof createAuthMiddleware>;
  readonly auth: AuthService;
  readonly phoneOtp: PhoneOtpPort;
  readonly phone: PhoneService;
  readonly dealers: DealersService;
  readonly dealersPublic: DealersPublicService;
  readonly admin: AdminService;
  readonly publicConfig: ConfigService;
  readonly media: MediaService;
}

export interface ContainerOverrides {
  readonly env?: Env;
  readonly prisma?: PrismaClient;
  readonly cache?: CachePort;
  readonly queue?: Queue;
  readonly storage?: StoragePort;
  readonly maps?: MapsPort;
  readonly mailer?: MailerPort;
  readonly sessions?: SessionResolver;
  readonly oauth?: OAuthProvider;
  readonly phoneOtp?: PhoneOtpPort;
}

// eslint-disable-next-line @typescript-eslint/require-await -- see above
export async function buildContainer(overrides: ContainerOverrides = {}): Promise<Container> {
  installBigIntJson();

  const prisma = overrides.prisma ?? createPrisma();
  const cache = overrides.cache ?? createCache(prisma);
  const rateLimit = createRateLimiter(cache);
  const config = createPlatformConfig(prisma, cache);
  const queue = overrides.queue ?? createQueue();
  const bus = createEventBus();
  const outbox = createOutboxPublisher(prisma, bus);
  const storage = overrides.storage ?? createStorage();
  const maps = overrides.maps ?? createMapsResolver();
  const mailer = overrides.mailer ?? createMailer();

  const sessionStore = createSessionService(prisma);
  const sessions = overrides.sessions ?? createResolver(prisma, sessionStore);
  const guards = createAuthMiddleware(sessions);
  const oauth = overrides.oauth ?? createGoogleOAuthProvider();

  const audit = createAuditService(prisma);
  const dealersRepo = createDealersRepository(prisma);
  const dealers = createDealersService({ prisma, repo: dealersRepo, storage, maps, audit });
  const dealersPublic = createDealersPublicService({ repo: dealersRepo, stats: noInventoryYet });
  const auth = createAuthService({
    prisma,
    sessions: sessionStore,
    oauth,
    dealers,
    audit,
    maps,
  });
  const phoneOtp = overrides.phoneOtp ?? createPhoneOtp();
  const phone = createPhoneService({ prisma, otp: phoneOtp, cache });
  const admin = createAdminService({ prisma, audit, config, storage, dealers });
  const publicConfig = createConfigService({ config });
  const media = createMediaService({ prisma, storage, queue });
  const notifications = createNotificationsService({ prisma, queue, mailer });

  return {
    env: overrides.env ?? env,
    prisma,
    cache,
    rateLimit,
    config,
    queue,
    bus,
    outbox,
    storage,
    maps,
    mailer,
    notifications,
    sessions,
    sessionStore,
    oauth,
    guards,
    auth,
    phoneOtp,
    phone,
    dealers,
    dealersPublic,
    admin,
    publicConfig,
    media,
  };
}

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

export async function startBackground(container: Container): Promise<void> {
  if (env.STORAGE_DRIVER !== 'local') {
    await ensureBucket();
    logger.info({ bucket: env.S3_BUCKET, endpoint: env.S3_ENDPOINT }, 'object storage ready');
  }

  if (!env.JOBS_ENABLED) return;

  await container.queue.start();

  if (!env.WORKER_INLINE) {
    logger.info('WORKER_INLINE=false — jobs and the outbox belong to the worker process');
    return;
  }

  await startWorker(container);
}

export async function startWorker(container: Container): Promise<void> {
  container.notifications.subscribe(container.bus);
  await container.notifications.work();
  container.outbox.start();

  logger.info(
    { mail: container.mailer.driver, jobs: env.JOBS_ENABLED },
    'background workers started',
  );
}

export async function closeContainer(container: Container): Promise<void> {
  container.outbox.stop();
  try {
    await container.queue.stop();
  } catch (error) {
    logger.warn({ err: error }, 'queue stop failed');
  }
  try {
    await container.cache.close();
  } catch (error) {
    logger.warn({ err: error }, 'cache close failed');
  }
  await container.prisma.$disconnect();
}
