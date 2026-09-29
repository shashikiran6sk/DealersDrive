import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export const ROOT = resolve(fileURLToPath(new URL('../../../', import.meta.url)));
export const REPO = ROOT;
export const PROMO = resolve(REPO, 'marketing/dealers-drive-promo');
export const DATABASE_URL =
  'postgresql://dealersdrive:dealersdrive@127.0.0.1:5432/dealersdrive_promo';
export const WEB = 'http://localhost:4300';
export const API = 'http://localhost:4301';

export function assertPromoEnvironment(env = process.env) {
  const url = new URL(env.DATABASE_URL || 'file:///missing');
  if (
    env.NODE_ENV !== 'development' ||
    env.APP_ENV !== 'local' ||
    !['postgresql:', 'postgres:'].includes(url.protocol) ||
    !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) ||
    url.pathname !== '/dealersdrive_promo' ||
    env.STORAGE_DRIVER !== 'local' ||
    env.STORAGE_LOCAL_DIR !== resolve(PROMO, '.storage')
  ) {
    throw new Error(
      'Promo tooling requires development/local, loopback dealersdrive_promo database and local storage. No remote override exists.',
    );
  }
}

export function promoEnvironment() {
  if (process.env.NODE_ENV === 'production' || process.env.APP_ENV === 'production') {
    throw new Error('Promotional tooling is forbidden in production.');
  }
  return {
    ...process.env,
    NODE_ENV: 'development',
    APP_ENV: 'local',
    DATABASE_URL,
    HOST: '127.0.0.1',
    PORT: '4301',
    WEB_ORIGIN: WEB,
    WEB_BASE_URL: WEB,
    API_BASE_URL: API,
    API_ORIGIN: API,
    MEDIA_BASE_URL: `${API}/media`,
    AUTH_MODE: 'cookie',
    PHONE_OTP_DRIVER: 'fake',
    PHONE_OTP_DEV_CODE: '123456',
    STORAGE_DRIVER: 'local',
    STORAGE_LOCAL_DIR: resolve(PROMO, '.storage'),
    CACHE_DRIVER: 'memory',
    MAIL_DRIVER: 'console',
    JOBS_ENABLED: 'false',
    WORKER_INLINE: 'false',
    RATE_LIMIT_ENABLED: 'false',
    LOG_LEVEL: 'warn',
    DOCS_ENABLED: 'false',
    METRICS_ENABLED: 'false',
    GRAFANA_CLOUD_LOGS_ENABLED: 'false',
    GOOGLE_CLIENT_ID: '',
    GOOGLE_CLIENT_SECRET: '',
    ADMIN_ALLOWLIST: 'operations@example.invalid',
    SUPPORT_EMAIL: 'support@example.invalid',
    SUPPORT_PHONE: '+919000009999',
    SESSION_SECRET: 'dealers-drive-promo-local-session-only',
    SESSION_COOKIE_DOMAIN: '',
    UPLOAD_SIGNING_SECRET: 'dealers-drive-promo-local-upload-only',
  };
}
