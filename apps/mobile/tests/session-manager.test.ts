import { SessionManager } from '../src/features/auth/session-manager';
import { ApiError } from '../src/services/api';

const CUSTOMER = {
  id: '11111111-1111-4111-8111-111111111111',
  fullName: 'Customer One',
  phone: '+919845599999',
  phoneDisplay: '+91 98455 99999',
};
const CREDENTIAL = { token: 'T'.repeat(43), expiresAt: '2030-01-01T00:00:00.000Z' };
function harness(raw: string | null = null) {
  let stored = raw;
  const storage = {
    read: jest.fn(() => Promise.resolve(stored)),
    write: jest.fn((value: string) => {
      stored = value;
      return Promise.resolve();
    }),
    remove: jest.fn(() => {
      stored = null;
      return Promise.resolve();
    }),
  };
  const api = {
    me: jest.fn(() => Promise.resolve({ customer: CUSTOMER, expiresAt: CREDENTIAL.expiresAt })),
    logout: jest.fn(() => Promise.resolve(undefined)),
  };
  const clear = jest.fn();
  const manager = new SessionManager(storage, api, clear);
  return { manager, storage, api, clear, stored: () => stored };
}
it('starts restoring with no private profile, deduplicates restore and accepts only server-confirmed identity', async () => {
  const h = harness(JSON.stringify(CREDENTIAL));
  expect(h.manager.getSnapshot()).toEqual({ status: 'restoring', customer: null, error: null });
  await Promise.all([h.manager.restore(), h.manager.restore()]);
  expect(h.api.me).toHaveBeenCalledTimes(1);
  expect(h.manager.getSnapshot()).toMatchObject({ status: 'authenticated', customer: CUSTOMER });
  expect(h.manager.token()).toBe(CREDENTIAL.token);
});
it.each([
  null,
  'not-json',
  JSON.stringify({ token: 'wrong', expiresAt: CREDENTIAL.expiresAt }),
  JSON.stringify({ ...CREDENTIAL, expiresAt: '2000-01-01T00:00:00.000Z' }),
])('refuses missing/corrupt/expired credentials without sending a request: %s', async (raw) => {
  const h = harness(raw);
  await h.manager.restore();
  expect(h.api.me).not.toHaveBeenCalled();
  expect(h.manager.getSnapshot().status).toBe('guest');
  expect(h.stored()).toBeNull();
});
it('clears revoked/expired credentials but hides private data and retains secure credentials on network failure', async () => {
  const revoked = harness(JSON.stringify(CREDENTIAL));
  revoked.api.me.mockRejectedValueOnce(new ApiError('AUTH_REQUIRED', 'Expired', 401));
  await revoked.manager.restore();
  expect(revoked.stored()).toBeNull();
  expect(revoked.manager.getSnapshot().status).toBe('guest');
  const offline = harness(JSON.stringify(CREDENTIAL));
  offline.api.me.mockRejectedValueOnce(new ApiError('NETWORK_UNAVAILABLE', 'Offline'));
  await offline.manager.restore();
  expect(offline.manager.getSnapshot()).toMatchObject({ status: 'unavailable', customer: null });
  expect(offline.stored()).not.toBeNull();
  expect(offline.manager.token()).toBeNull();
  await offline.manager.restore();
  expect(offline.manager.getSnapshot().status).toBe('authenticated');
});
it('does not let a slow old restore overwrite a newly authenticated account', async () => {
  const h = harness(JSON.stringify(CREDENTIAL));
  let resolve!: (value: Awaited<ReturnType<typeof h.api.me>>) => void;
  h.api.me.mockImplementationOnce(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  const restoring = h.manager.restore();
  await Promise.resolve();
  await Promise.resolve();
  const other = {
    ...CUSTOMER,
    id: '22222222-2222-4222-8222-222222222222',
    fullName: 'Customer Two',
  };
  await h.manager.accept(
    h.manager.beginAuthentication(),
    { ...CREDENTIAL, token: 'S'.repeat(43) },
    other,
  );
  resolve({ customer: CUSTOMER, expiresAt: CREDENTIAL.expiresAt });
  await restoring;
  expect(h.manager.getSnapshot().customer?.id).toBe(other.id);
  expect(h.stored()).toBe(JSON.stringify({ ...CREDENTIAL, token: 'S'.repeat(43) }));
});
it('cancels pending authentication without persisting or executing an intent', async () => {
  const h = harness();
  const pending = h.manager.pending.request({ kind: 'save', slug: 'car-one' });
  const generation = h.manager.beginAuthentication();
  h.manager.cancelAuthentication(generation);
  expect(await h.manager.accept(generation, CREDENTIAL, CUSTOMER)).toBe(false);
  expect(h.storage.write).not.toHaveBeenCalled();
  expect(h.manager.pending.consume(pending.id, CUSTOMER.id)).toBeNull();
});
it('serializes logout deletion behind a pending secure write so credentials cannot reappear', async () => {
  const h = harness();
  let release!: () => void;
  const commitWrite = h.storage.write.getMockImplementation();
  if (!commitWrite) throw new Error('Missing storage fixture.');
  h.storage.write.mockImplementationOnce(
    (value) =>
      new Promise<void>((resolve) => {
        release = () => {
          void commitWrite(value).then(resolve);
        };
      }),
  );
  const generation = h.manager.beginAuthentication();
  const accepting = h.manager.accept(generation, CREDENTIAL, CUSTOMER);
  await Promise.resolve();
  await Promise.resolve();
  const logout = h.manager.logout();
  release();
  await accepting;
  await logout;
  expect(h.storage.remove).toHaveBeenCalled();
  expect(h.stored()).toBeNull();
  expect(h.manager.getSnapshot().status).toBe('guest');
  expect(h.manager.token()).toBeNull();
});
it('removes a cancelled candidate credential even when cancellation races secure storage', async () => {
  const h = harness();
  let release!: () => void;
  const commitWrite = h.storage.write.getMockImplementation();
  if (!commitWrite) throw new Error('Missing storage fixture.');
  h.storage.write.mockImplementationOnce(
    (value) =>
      new Promise<void>((resolve) => {
        release = () => {
          void commitWrite(value).then(resolve);
        };
      }),
  );
  const generation = h.manager.beginAuthentication();
  const accepting = h.manager.accept(generation, CREDENTIAL, CUSTOMER);
  await Promise.resolve();
  await Promise.resolve();
  h.manager.cancelAuthentication(generation);
  release();
  await accepting;
  await Promise.resolve();
  await Promise.resolve();
  expect(h.storage.remove).toHaveBeenCalled();
  expect(h.manager.token()).toBeNull();
});
it('keeps an OTP flow alive across foreground session restoration, then binds its intent once', async () => {
  const h = harness();
  const action = h.manager.pending.request({ kind: 'enquiry', slug: 'car-one' });
  const generation = h.manager.beginAuthentication();
  await h.manager.restore();
  expect(h.api.me).not.toHaveBeenCalled();
  expect(await h.manager.accept(generation, CREDENTIAL, CUSTOMER)).toBe(true);
  expect(h.manager.pending.consume(action.id, CUSTOMER.id)).toEqual({
    kind: 'enquiry',
    slug: 'car-one',
  });
  expect(h.manager.pending.consume(action.id, CUSTOMER.id)).toBeNull();
});

it('preserves verified identity and private cache through successful same-account foreground refresh', async () => {
  const h = harness(JSON.stringify(CREDENTIAL));
  await h.manager.restore();
  h.clear.mockClear();
  const snapshots: unknown[] = [];
  h.manager.subscribe(() => snapshots.push(h.manager.getSnapshot()));
  await h.manager.restore();
  expect(snapshots).not.toContainEqual({ status: 'restoring', customer: null, error: null });
  expect(h.clear).not.toHaveBeenCalled();
  expect(h.manager.getSnapshot().customer?.id).toBe(CUSTOMER.id);
});

it('clears a previously verified account immediately when foreground refresh detects revocation', async () => {
  const h = harness(JSON.stringify(CREDENTIAL));
  await h.manager.restore();
  h.api.me.mockRejectedValueOnce(new ApiError('AUTH_REQUIRED', 'Revoked', 401));
  await h.manager.restore();
  expect(h.manager.getSnapshot()).toMatchObject({ status: 'guest', customer: null });
  expect(h.clear).toHaveBeenCalled();
  expect(h.manager.token()).toBeNull();
});
it('never confirms secure persistence or server logout after a failed operation', async () => {
  const h = harness();
  h.storage.write.mockRejectedValueOnce(new Error('keystore unavailable'));
  await expect(
    h.manager.accept(h.manager.beginAuthentication(), CREDENTIAL, CUSTOMER),
  ).rejects.toThrow('Secure storage');
  expect(h.manager.getSnapshot().status).not.toBe('authenticated');
  await h.manager.accept(h.manager.beginAuthentication(), CREDENTIAL, CUSTOMER);
  h.api.logout.mockRejectedValueOnce(new ApiError('NETWORK_UNAVAILABLE', 'Offline'));
  expect(await h.manager.logout()).toBe(false);
  expect(h.stored()).toBeNull();
  expect(h.manager.pending.peek()).toBeNull();
});
