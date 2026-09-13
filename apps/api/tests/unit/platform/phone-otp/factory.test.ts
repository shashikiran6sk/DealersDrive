import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * R39 — the `PHONE_OTP_DRIVER` seam.
 *
 * One line of code, and it is worth a test for the same reason the mail and
 * storage factories are: it is the single place a deployment's choice becomes
 * an object, and getting it backwards would mean a production API accepting a
 * fixed code — a failure with no symptom until somebody looks.
 */
afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

async function createWith(vars: Record<string, string>) {
  vi.resetModules();
  for (const [key, value] of Object.entries(vars)) vi.stubEnv(key, value);
  const { createPhoneOtp } = await import('../../../../src/platform/phone-otp/factory.js');
  return createPhoneOtp();
}

describe('createPhoneOtp', () => {
  it('builds the development driver by default', async () => {
    expect((await createWith({})).driver).toBe('fake');
  });

  it('builds the MSG91 driver when the deployment asks for it', async () => {
    const otp = await createWith({
      PHONE_OTP_DRIVER: 'msg91',
      MSG91_AUTH_KEY: 'key',
      MSG91_WIDGET_ID: 'widget',
      MSG91_WIDGET_TOKEN: 'token',
    });

    expect(otp.driver).toBe('msg91');
  });

  /** The dev code is configuration, not a constant baked into the adapter. */
  it('gives the development driver the configured code', async () => {
    const otp = await createWith({ PHONE_OTP_DEV_CODE: '424242' });

    await expect(otp.identify('dev-otp:919840012345:424242')).resolves.toMatchObject({
      status: 'VERIFIED',
    });
    await expect(otp.identify('dev-otp:919840012345:123456')).resolves.toMatchObject({
      status: 'REJECTED',
    });
  });
});
