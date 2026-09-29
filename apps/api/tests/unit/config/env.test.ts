import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('dotenv', () => ({ default: { config: () => ({ parsed: {} }) } }));

const original = { ...process.env };
const requiredExternal = {
  AWS_REGION: 'ap-south-1',
  S3_BUCKET: 'dealers-drive-development',
  GOOGLE_CLIENT_ID: 'google-client',
  GOOGLE_CLIENT_SECRET: 'google-secret',
  MSG91_AUTH_KEY: 'msg91-key',
  MSG91_WIDGET_ID: 'widget-id',
  MSG91_WIDGET_TOKEN: 'widget-token',
};
const production = {
  ...requiredExternal,
  APP_ENV: 'production',
  NODE_ENV: 'production',
  S3_BUCKET: 'dealers-drive-production',
  DATABASE_URL: 'postgresql://user:secret@db.example:5432/dealersdrive',
  WEB_ORIGIN: 'https://dealers-drive.example',
  WEB_BASE_URL: 'https://dealers-drive.example',
  API_BASE_URL: 'https://api.dealers-drive.example',
  MEDIA_BASE_URL: 'https://api.dealers-drive.example/media',
  SESSION_SECRET: 'this-is-a-production-session-secret',
  ADMIN_ALLOWLIST: 'admin@dealers-drive.example',
  METRICS_SCRAPE_TOKEN: 'this-is-a-long-metrics-scrape-token',
  RESEND_API_KEY: 'resend-secret',
};

async function load(values: Record<string, string>) {
  vi.resetModules();
  process.env = { PATH: original.PATH ?? '', ...values };
  return import('../../../src/config/env.js');
}

async function error(values: Record<string, string>): Promise<string> {
  const lines: string[] = [];
  vi.spyOn(console, 'error').mockImplementation((value: unknown) => {
    lines.push(String(value));
  });
  vi.spyOn(process, 'exit').mockImplementation(() => {
    throw new Error('configuration rejected');
  });
  await expect(load(values)).rejects.toThrow('configuration rejected');
  return lines.join('\n');
}

afterEach(() => {
  process.env = { ...original };
  vi.restoreAllMocks();
  vi.resetModules();
});

describe('application environments', () => {
  it('runs local without cloud credentials', async () => {
    const { env, config } = await load({ APP_ENV: 'local', NODE_ENV: 'development' });
    expect(config.app.env).toBe('local');
    expect(config.database.url).toContain('localhost:5432/dealersdrive');
    expect(config.storage.provider).toBe('minio');
    expect(config.email.provider).toBe('smtp');
    expect(config.otp.provider).toBe('fake');
    expect(config.auth.mode).toBe('cookie');
    expect(config.auth.google.enabled).toBe(false);
    expect(config.docs.enabled).toBe(true);
    expect(env.S3_ACCESS_KEY_ID).toBe('dealersdrive');
  });

  it('uses real integrations and local PostgreSQL in development', async () => {
    const { config } = await load({
      APP_ENV: 'development',
      NODE_ENV: 'development',
      ...requiredExternal,
    });
    expect(config.database.url).toContain('localhost:5432/dealersdrive');
    expect(config.storage.provider).toBe('s3');
    expect(config.email.provider).toBe('smtp');
    expect(config.otp.provider).toBe('msg91');
    expect(config.auth.google.enabled).toBe(true);
    expect(config.auth.mode).toBe('cookie');
  });

  it('enforces production providers, metrics, and hidden docs', async () => {
    const { config } = await load(production);
    expect(config.storage.provider).toBe('s3');
    expect(config.email.provider).toBe('resend');
    expect(config.otp.provider).toBe('msg91');
    expect(config.auth.mode).toBe('cookie');
    expect(config.docs.enabled).toBe(false);
    expect(config.metrics.enabled).toBe(true);
  });

  it.each([
    ['PHONE_OTP_DRIVER', 'fake'],
    ['STORAGE_DRIVER', 'minio'],
    ['MAIL_DRIVER', 'smtp'],
    ['AUTH_MODE', 'dev'],
    ['DOCS_ENABLED', 'true'],
  ])('rejects %s=%s in production', async (key, value) => {
    expect(await error({ ...production, [key]: value })).toContain(key);
  });

  it('rejects missing production secrets', async () => {
    const { SESSION_SECRET: _secret, ...incomplete } = production;
    expect(await error(incomplete)).toContain('SESSION_SECRET');
  });

  it('rejects missing development integrations and a production bucket', async () => {
    const { GOOGLE_CLIENT_SECRET: _secret, ...incomplete } = requiredExternal;
    expect(
      await error({ APP_ENV: 'development', NODE_ENV: 'development', ...incomplete }),
    ).toContain('GOOGLE_CLIENT_SECRET');
    expect(
      await error({
        APP_ENV: 'development',
        NODE_ENV: 'development',
        ...requiredExternal,
        S3_BUCKET: 'dealers-drive-production',
      }),
    ).toContain('S3_BUCKET');
  });
});
