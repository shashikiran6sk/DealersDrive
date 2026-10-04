import test from 'node:test';
import assert from 'node:assert/strict';
import { assertPromoEnvironment, promoEnvironment } from './environment.mjs';
test('accepts only the isolated local development database', () => {
  const env = promoEnvironment();
  assert.doesNotThrow(() => assertPromoEnvironment(env));
  for (const patch of [
    { NODE_ENV: 'production' },
    { APP_ENV: 'production' },
    { STORAGE_DRIVER: 's3' },
    { STORAGE_LOCAL_DIR: '/tmp/unrelated-storage' },
    { DATABASE_URL: 'https://localhost/dealersdrive_promo' },
    { DATABASE_URL: 'postgresql://localhost:5432/dealersdrive' },
    { DATABASE_URL: 'postgresql://remote.example:5432/dealersdrive_promo' },
    { DATABASE_URL: '' },
  ])
    assert.throws(() => assertPromoEnvironment({ ...env, ...patch }));
});
