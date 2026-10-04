import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});
describe('strict DB connection', () => {
  it('removes SSL URL overrides and verifies certificates with the configured CA', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'dd-ca-'));
    try {
      const file = join(directory, 'ca.pem');
      writeFileSync(file, 'trusted-ca');
      vi.stubEnv('DB_SSL_CA_FILE', file);
      vi.stubEnv(
        'DATABASE_URL',
        'postgresql://app:password@db.example/app?sslmode=no-verify&sslrootcert=bad&connection_limit=5',
      );
      vi.resetModules();
      const { databaseConnection } = await import('../../../../src/platform/db/connection.js');
      const value = databaseConnection();
      expect(value.ssl).toEqual({ ca: 'trusted-ca', rejectUnauthorized: true });
      expect(value.connectionString).not.toContain('sslmode');
      expect(value.connectionString).not.toContain('sslrootcert');
      expect(value.connectionString).toContain('connection_limit=5');
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
  it('fails instead of disabling TLS if the configured CA is missing', async () => {
    vi.stubEnv('DB_SSL_CA_FILE', '/nonexistent/dealers-drive-ca.pem');
    vi.resetModules();
    const { databaseConnection } = await import('../../../../src/platform/db/connection.js');
    expect(() => databaseConnection()).toThrow();
  });
});
