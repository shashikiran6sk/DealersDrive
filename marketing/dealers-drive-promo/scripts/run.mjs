import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { REPO, PROMO, DATABASE_URL, promoEnvironment } from './environment.mjs';

const env = promoEnvironment();
const apiRequire = createRequire(resolve(REPO, 'apps/api/package.json'));
const run = (args, cwd = REPO) =>
  new Promise((res, rej) => {
    const child = spawn('pnpm', args, { cwd, env, stdio: 'inherit' });
    child.on('exit', (code) =>
      code === 0 ? res() : rej(new Error(`pnpm ${args.join(' ')} exited ${code}`)),
    );
    child.on('error', rej);
  });

switch (process.argv[2]) {
  case 'prepare': {
    const { Client } = apiRequire('pg');
    const url = new URL(DATABASE_URL);
    url.pathname = '/postgres';
    const client = new Client({ connectionString: url.href });
    await client.connect();
    const exists = await client.query(
      "SELECT 1 FROM pg_database WHERE datname = 'dealersdrive_promo'",
    );
    if (!exists.rowCount) await client.query('CREATE DATABASE dealersdrive_promo');
    await client.end();
    await run(['--filter', '@dealers-drive/api', 'db:migrate:deploy']);
    await run([
      '--filter',
      '@dealers-drive/api',
      'exec',
      'tsx',
      '../../marketing/dealers-drive-promo/scripts/seed.ts',
    ]);
    break;
  }
  case 'verify':
    await run([
      '--filter',
      '@dealers-drive/api',
      'exec',
      'tsx',
      '../../marketing/dealers-drive-promo/scripts/verify-demo.ts',
    ]);
    break;
  case 'api':
    await run(['--filter', '@dealers-drive/api', 'exec', 'tsx', 'src/index.ts']);
    break;
  case 'web':
    await run(['--filter', '@dealers-drive/web', 'exec', 'next', 'dev', '--port', '4300']);
    break;
  default:
    throw new Error('Usage: node scripts/run.mjs prepare|api|web');
}
