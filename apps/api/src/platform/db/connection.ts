import { readFileSync } from 'node:fs';

import { env } from '../../config/env.js';

export function databaseConnection() {
  if (!env.DB_SSL_CA_FILE) return { connectionString: env.DATABASE_URL };

  const url = new URL(env.DATABASE_URL);
  for (const key of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert']) url.searchParams.delete(key);
  return {
    connectionString: url.toString(),
    ssl: { ca: readFileSync(env.DB_SSL_CA_FILE, 'utf8'), rejectUnauthorized: true },
  };
}
