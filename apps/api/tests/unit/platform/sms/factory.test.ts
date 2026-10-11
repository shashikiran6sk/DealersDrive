import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * R118 — the `SMS_DRIVER` seam, the one place a deployment's choice becomes an
 * object. The MSG91 case builds the adapter only; nothing is sent.
 */
afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

async function createWith(vars: Record<string, string>) {
  vi.resetModules();
  for (const [key, value] of Object.entries(vars)) vi.stubEnv(key, value);
  const { createSms } = await import('../../../../src/platform/sms/factory.js');
  return createSms();
}

describe('createSms', () => {
  it('builds the console driver the suite is pinned to', async () => {
    expect((await createWith({})).driver).toBe('console');
  });

  it('builds the disabled driver, which sends nothing', async () => {
    const sms = await createWith({ SMS_DRIVER: 'disabled' });
    expect(sms.driver).toBe('disabled');
    await expect(
      sms.send({
        to: '+919840012345',
        templateId: 't',
        variables: {},
        tag: 't',
        idempotencyKey: 'k',
      }),
    ).resolves.toEqual({ providerMessageId: null });
  });

  it('builds the MSG91 driver outside test when it is configured', async () => {
    const sms = await createWith({
      NODE_ENV: 'development',
      SMS_DRIVER: 'msg91',
      MSG91_AUTH_KEY: 'key',
      MSG91_TICKET_ACK_TEMPLATE_ID: 'template',
    });
    expect(sms.driver).toBe('msg91');
  });
});
