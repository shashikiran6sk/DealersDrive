import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import {
  registerProgressiveAction,
  saveProgressiveAction,
  registerProgressiveAssistedAction,
  reviewProgressiveAction,
} from '../../../../src/features/progressive/actions.js';
const originalFetch = globalThis.fetch;
let calls: { url: string; init: RequestInit }[] = [];
function form(fields: Record<string, string>) {
  const f = new FormData();
  for (const [key, value] of Object.entries(fields)) f.set(key, value);
  return f;
}
beforeEach(() => {
  calls = [];
  globalThis.fetch = vi.fn<typeof fetch>((url, init) => {
    calls.push({ url: url instanceof Request ? url.url : String(url), init: init ?? {} });
    return Promise.resolve(
      new Response(JSON.stringify({ id: '11111111-1111-4111-8111-111111111111' }), {
        status: 200,
      }),
    );
  });
});
afterEach(() => {
  globalThis.fetch = originalFetch;
});
it('registers essentials without attaching typed email or manufactured documents', async () => {
  await expect(
    registerProgressiveAction(
      {},
      form({
        fullName: 'Synthetic Rep',
        phone: '9000100001',
        legalName: 'Synthetic Business',
        city: 'Vellore',
        district: 'Vellore',
        state: 'Tamil Nadu',
        declaration: 'on',
        email: 'forged@example.test',
      }),
    ),
  ).rejects.toThrow('NEXT_REDIRECT:/dealer/register');
  expect(calls[0]?.url).toContain('/v1/auth/dealer/register');
  expect(
    JSON.parse(typeof calls[0]?.init.body === 'string' ? calls[0].init.body : '{}'),
  ).not.toHaveProperty('email');
});
it('refuses saving registration before consent', async () => {
  const result = await registerProgressiveAction(
    {},
    form({
      fullName: 'Synthetic Rep',
      phone: '9000100001',
      legalName: 'Synthetic Business',
      city: 'Vellore',
      district: 'Vellore',
      state: 'Tamil Nadu',
    }),
  );
  expect(result.errors).toHaveProperty('declaration');
  expect(calls).toEqual([]);
});
it('saves partial progress and leaves previous identifiers untouched when blank', async () => {
  expect(
    await saveProgressiveAction(
      {},
      form({ addressLine: 'Synthetic address', pincode: '', pan: '', gstin: '' }),
    ),
  ).toMatchObject({ saved: true });
  expect(JSON.parse(typeof calls[0]?.init.body === 'string' ? calls[0].init.body : '{}')).toEqual({
    address: { line: 'Synthetic address' },
  });
});
it('rejects invalid supplied registration IDs before calling the backend', async () => {
  expect(await saveProgressiveAction({}, form({ gstin: 'invalid' }))).toHaveProperty(
    'errors.gstin',
  );
  expect(calls).toEqual([]);
});
it('does not save assisted registration with an absent phone ticket', async () => {
  expect(
    await registerProgressiveAssistedAction(
      {},
      form({
        contactName: 'Synthetic Rep',
        email: 'rep@example.test',
        legalName: 'Synthetic Business',
        city: 'Vellore',
        district: 'Vellore',
        state: 'Tamil Nadu',
        declaration: 'on',
      }),
    ),
  ).toHaveProperty('errors.phoneTicket');
  expect(calls).toEqual([]);
});
it('does not record an incomplete verification assessment', async () => {
  expect(
    await reviewProgressiveAction(
      {},
      form({ version: '0', dealerId: '11111111-1111-4111-8111-111111111111' }),
    ),
  ).toHaveProperty('errors');
  expect(calls).toEqual([]);
});
