import { EventEmitter } from 'node:events';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ txt: vi.fn(), ipv4: vi.fn(), connect: vi.fn() }));
vi.mock('node:dns/promises', () => ({
  Resolver: class {
    resolveTxt = mocks.txt;
    resolve4 = mocks.ipv4;
  },
}));
vi.mock('node:tls', () => ({ connect: mocks.connect }));
import {
  certificateReady,
  domainOwnership,
} from '../../../../src/modules/storefront/domain-network.js';

beforeEach(() => {
  vi.clearAllMocks();
});
describe('ownership DNS and pinned TLS readiness', () => {
  it('checks a fresh exact TXT token and handles missing DNS', async () => {
    mocks.txt.mockResolvedValue([['dd-proof-', 'token']]);
    expect(await domainOwnership('cars.example.com', 'dd-proof-token')).toBe(true);
    expect(mocks.txt).toHaveBeenCalledWith('_dealers-drive.cars.example.com');
    expect(await domainOwnership('cars.example.com', 'different')).toBe(false);
    mocks.txt.mockRejectedValue(new Error('DNS unavailable'));
    expect(await domainOwnership('cars.example.com', 'token')).toBe(false);
    await expect(domainOwnership('http://evil.com', 'token')).rejects.toThrow();
  });
  it('does not connect when DNS fails, is empty or includes a private address', async () => {
    mocks.ipv4.mockRejectedValue(new Error('DNS unavailable'));
    expect(await certificateReady('cars.example.com')).toBe(false);
    mocks.ipv4.mockResolvedValue([]);
    expect(await certificateReady('cars.example.com')).toBe(false);
    mocks.ipv4.mockResolvedValue(['8.8.8.8', '127.0.0.1']);
    expect(await certificateReady('cars.example.com')).toBe(false);
    expect(mocks.connect).not.toHaveBeenCalled();
  });
  it.each(['authorized', 'unauthorized', 'error', 'timeout'])(
    'handles TLS %s without disabling validation',
    async (mode) => {
      mocks.ipv4.mockResolvedValue(['8.8.8.8']);
      const socket = Object.assign(new EventEmitter(), {
        authorized: mode === 'authorized',
        destroy: vi.fn(),
        setTimeout: vi.fn((_ms: number, callback: () => void) => {
          if (mode === 'timeout') queueMicrotask(callback);
        }),
      });
      mocks.connect.mockImplementation(() => {
        queueMicrotask(() => {
          if (mode !== 'timeout')
            socket.emit(mode === 'error' ? 'error' : 'secureConnect', new Error('invalid cert'));
        });
        return socket;
      });
      expect(await certificateReady('cars.example.com')).toBe(mode === 'authorized');
      expect(mocks.connect).toHaveBeenCalledWith({
        host: '8.8.8.8',
        port: 443,
        servername: 'cars.example.com',
        rejectUnauthorized: true,
      });
      expect(socket.destroy).toHaveBeenCalled();
    },
  );
});
