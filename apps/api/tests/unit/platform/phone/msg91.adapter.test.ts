import { describe, expect, it, vi } from 'vitest';
import { createMsg91PhoneVerifier } from '../../../../src/platform/phone/msg91.adapter.js';

const options = { authKey: 'test-secret', templateId: 'approved-template', timeoutMs: 100 };
const reply = (type: string, message: string) => new Response(JSON.stringify({ type, message }));

describe('MSG91 SendOTP', () => {
  it('asks the provider to generate six digits with five-minute expiry', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(reply('success', 'request-1'));
    await createMsg91PhoneVerifier(fetcher, options).send('+919840012345');
    const [url, init] = fetcher.mock.calls[0]!;
    const parsed = new URL(url instanceof Request ? url.url : url);
    expect(parsed.origin).toBe('https://control.msg91.com');
    expect(parsed.searchParams.get('mobile')).toBe('919840012345');
    expect(parsed.searchParams.get('otp_length')).toBe('6');
    expect(parsed.searchParams.get('otp_expiry')).toBe('5');
    expect(parsed.searchParams.get('template_id')).toBe('approved-template');
    expect(parsed.searchParams.has('otp')).toBe(false);
    expect(parsed.searchParams.has('authkey')).toBe(false);
    expect(init).toMatchObject({
      method: 'POST',
      headers: { authkey: 'test-secret' },
      redirect: 'error',
      cache: 'no-store',
    });
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });
  it('verifies the exact phone and code against MSG91', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(reply('success', 'OTP verified success'));
    await expect(
      createMsg91PhoneVerifier(fetcher, options).verify('+919840012345', '123456'),
    ).resolves.toBeUndefined();
    const [url, init] = fetcher.mock.calls[0]!;
    expect(new URL(url instanceof Request ? url.url : url).pathname).toBe('/api/v5/otp/verify');
    expect(new URL(url instanceof Request ? url.url : url).searchParams.get('otp')).toBe('123456');
    expect(init?.method).toBe('GET');
  });
  it.each([
    ['error', 'OTP not match', 'PHONE_CODE_INVALID'],
    ['error', 'Invalid OTP', 'PHONE_CODE_INVALID'],
    ['error', 'OTP expired', 'PHONE_CODE_EXPIRED'],
    ['success', 'Mobile no. already verified', 'PHONE_CODE_EXPIRED'],
    ['success', 'arbitrary success', 'PHONE_VERIFICATION_UNAVAILABLE'],
    ['error', 'Invalid authkey', 'PHONE_VERIFICATION_UNAVAILABLE'],
  ])('maps %s / %s without treating it as verification', async (type, message, code) => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(reply(type, message));
    await expect(
      createMsg91PhoneVerifier(fetcher, options).verify('+919840012345', '123456'),
    ).rejects.toMatchObject({ code });
  });
  it.each([
    new Response('bad', { status: 503 }),
    new Response('not json'),
    new Response('{}'),
    reply('error', 'balance low'),
  ])('rejects failed or malformed sends', async (response) => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response);
    await expect(
      createMsg91PhoneVerifier(fetcher, options).send('+919840012345'),
    ).rejects.toMatchObject({ code: 'PHONE_VERIFICATION_UNAVAILABLE' });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('redacts transport failures instead of attaching URLs or secrets', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new Error('url?otp=123456&authkey=test-secret'));
    try {
      await createMsg91PhoneVerifier(fetcher, options).verify('+919840012345', '123456');
    } catch (error) {
      expect(error).toMatchObject({ code: 'PHONE_VERIFICATION_UNAVAILABLE' });
      expect((error as Error).cause).toBeUndefined();
      expect(String(error)).not.toContain('123456');
      expect(String(error)).not.toContain('test-secret');
    }
  });
});
