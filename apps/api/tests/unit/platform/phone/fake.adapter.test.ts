import { describe, expect, it } from 'vitest';
import { createFakePhoneVerifier } from '../../../../src/platform/phone/fake.adapter.js';
describe('offline phone provider', () => {
  it('sends nothing and accepts the configured code', async () => {
    const provider = createFakePhoneVerifier();
    expect(provider.driver).toBe('fake');
    await expect(provider.send('+919840012345')).resolves.toBeUndefined();
    await expect(provider.verify('+919840012345', '123456')).resolves.toBeUndefined();
  });
  it('rejects an incorrect code', async () => {
    await expect(createFakePhoneVerifier().verify('+919840012345', '000000')).rejects.toMatchObject(
      { code: 'PHONE_CODE_INVALID' },
    );
  });
});
