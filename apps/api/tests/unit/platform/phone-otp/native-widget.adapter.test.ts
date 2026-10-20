import type * as EnvModule from '../../../../src/config/env.js';
import { afterEach, expect, it, vi } from 'vitest';
import { env } from '../../../../src/config/env.js';
import { createNativeWidget } from '../../../../src/platform/phone-otp/native-widget.adapter.js';

const original = {
  MSG91_WIDGET_ID: env.MSG91_WIDGET_ID,
  MSG91_WIDGET_TOKEN: env.MSG91_WIDGET_TOKEN,
};
afterEach(() => {
  Object.assign(env, original);
  vi.restoreAllMocks();
});
function provider() {
  env.MSG91_WIDGET_ID = 'test-widget';
  env.MSG91_WIDGET_TOKEN = 'test-secret';
  const fetcher = vi.fn<typeof fetch>();
  return { fetcher, widget: createNativeWidget(fetcher) };
}
it('uses provider-owned standard web widget contracts only on the backend', async () => {
  const { fetcher, widget } = provider();
  fetcher.mockResolvedValueOnce(
    new Response(JSON.stringify({ type: 'success', message: 'req123' })),
  );
  expect(await widget.send('+919845599999')).toBe('req123');
  expect(fetcher).toHaveBeenLastCalledWith(
    'https://control.msg91.com/api/v5/widget/sendOtp',
    expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        widgetId: 'test-widget',
        tokenAuth: 'test-secret',
        identifier: '919845599999',
      }),
    }),
  );
  fetcher.mockResolvedValueOnce(
    new Response(JSON.stringify({ type: 'success', message: 'req456' })),
  );
  expect(await widget.resend('req123')).toBe('req456');
  expect(fetcher).toHaveBeenLastCalledWith(
    'https://control.msg91.com/api/v5/widget/retryOtp',
    expect.objectContaining({
      body: JSON.stringify({
        widgetId: 'test-widget',
        tokenAuth: 'test-secret',
        reqId: 'req123',
        retryChannel: 11,
      }),
    }),
  );
  fetcher.mockResolvedValueOnce(
    new Response(JSON.stringify({ type: 'success', 'access-token': 'verified.jwt.token' })),
  );
  expect(await widget.verify('req123', '123456')).toBe('verified.jwt.token');
});
it('refuses HTTP-success provider errors and malformed success payloads', async () => {
  const { fetcher, widget } = provider();
  fetcher.mockResolvedValueOnce(
    new Response(JSON.stringify({ type: 'error', code: 201, message: 'private diagnostic' })),
  );
  await expect(widget.verify('req123', '000000')).rejects.toMatchObject({
    code: 'NATIVE_OTP_INVALID',
  });
  fetcher.mockResolvedValueOnce(new Response(JSON.stringify({ type: 'success' })));
  await expect(widget.send('+919845599999')).rejects.toMatchObject({ status: 503 });
  fetcher.mockResolvedValueOnce(
    new Response(JSON.stringify({ type: 'success', message: 'not-a-token' })),
  );
  await expect(widget.verify('req123', '123456')).rejects.toMatchObject({ status: 503 });
});
it('bounds upstream failures and never surfaces provider secrets or diagnostics', async () => {
  const { fetcher, widget } = provider();
  fetcher.mockRejectedValueOnce(new Error('test-secret'));
  await expect(widget.send('+919845599999')).rejects.toMatchObject({ status: 503 });
  fetcher.mockResolvedValueOnce(new Response('private diagnostic', { status: 429 }));
  await expect(widget.verify('req123', '123456')).rejects.toMatchObject({ status: 503 });
  env.MSG91_WIDGET_TOKEN = undefined;
  await expect(widget.send('+919845599999')).rejects.toMatchObject({ status: 503 });
  expect(fetcher).toHaveBeenCalledTimes(2);
});

vi.mock('../../../../src/config/env.js', async (importOriginal) => {
  const actual = await importOriginal<typeof EnvModule>();
  return { ...actual, env: { ...actual.env } };
});
