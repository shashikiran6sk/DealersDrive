import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import type { PhoneOtpWidget } from '@dealers-drive/contracts';
import { createAdminPhoneService } from '../../../../src/modules/auth/admin-phone.service.js';
import type { SessionService } from '../../../../src/modules/auth/session.service.js';
import type { AuditService } from '../../../../src/platform/audit/audit.service.js';
import { createMemoryCache } from '../../../../src/platform/cache/memory.adapter.js';
import type * as EnvModule from '../../../../src/config/env.js';
const config = vi.hoisted(() => ({ authKey: undefined as string | undefined }));
vi.mock('../../../../src/config/env.js', async (importOriginal) => {
  const original = await importOriginal<typeof EnvModule>();
  return {
    ...original,
    env: {
      ...original.env,
      get MSG91_AUTH_KEY() {
        return config.authKey;
      },
    },
  };
});
const widget: PhoneOtpWidget = {
  enabled: true,
  driver: 'msg91',
  widgetId: 'synthetic-public-widget',
  tokenAuth: ['synthetic', 'public', 'widget', 'token'].join('-'),
  devCode: null,
  reason: null,
};
function service(value = widget) {
  return createAdminPhoneService({
    prisma: {} as PrismaClient,
    sessions: {} as SessionService,
    audit: {} as AuditService,
    cache: createMemoryCache(),
    proof: { widget: () => value, prove: vi.fn() },
  });
}
beforeEach(() => {
  config.authKey = undefined;
});
describe('admin mobile provider availability', () => {
  it('disables mobile sign-in when the server credential is absent despite a configured public widget', () => {
    expect(service().widget()).toMatchObject({
      enabled: false,
      reason: 'Mobile sign-in is unavailable. Continue with Google.',
    });
  });
  it('returns only public provider settings when server verification is configured', () => {
    config.authKey = ['synthetic', 'server', 'only', 'key'].join('-');
    const response = service().widget();
    expect(response).toEqual(widget);
    expect(JSON.stringify(response)).not.toContain(config.authKey);
  });
  it('preserves disabled widget status and never exposes a provider verification credential', () => {
    config.authKey = ['synthetic', 'server', 'only', 'key'].join('-');
    const response = service({
      ...widget,
      enabled: false,
      reason: 'Provider unavailable',
    }).widget();
    expect(response.enabled).toBe(false);
    expect(response.reason).toBe('Provider unavailable');
  });
});
