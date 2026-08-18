import { describe, expect, it } from 'vitest';

import {
  createOAuthTransaction,
  openTransaction,
  safeReturnTo,
  sealTransaction,
  OAUTH_TRANSACTION_TTL_SECONDS,
} from '../../../../src/modules/auth/oauth-transaction.js';

/**
 * The half of the OAuth round trip that has to survive a redirect to Google.
 *
 * It lives in one HMAC-signed cookie rather than a table, so the properties
 * that matter are the ones a table would have given for free: the browser
 * cannot edit what it is holding, and a captured cookie is worthless once its
 * ten minutes are up.
 */
describe('minting', () => {
  it('gives each sign-in unguessable state, nonce and verifier', () => {
    const first = createOAuthTransaction('/dealer');
    const second = createOAuthTransaction('/dealer');

    for (const value of [first.state, first.nonce, first.codeVerifier]) {
      expect(value.length).toBeGreaterThanOrEqual(43);
    }
    expect(first.state).not.toBe(second.state);
    expect(first.nonce).not.toBe(second.nonce);
    expect(first.codeVerifier).not.toBe(second.codeVerifier);
  });

  /** RFC 7636 §4.1 — unreserved characters only, 43 to 128 of them. */
  it('mints a PKCE verifier of the required shape', () => {
    expect(createOAuthTransaction('/dealer').codeVerifier).toMatch(/^[A-Za-z0-9\-._~]{43,128}$/);
  });
});

describe('sealing and opening', () => {
  it('round-trips a transaction', () => {
    const transaction = createOAuthTransaction('/dealer/inventory');

    expect(openTransaction(sealTransaction(transaction))).toEqual(transaction);
  });

  it('refuses a cookie that was not there', () => {
    expect(openTransaction(undefined)).toBeNull();
    expect(openTransaction('')).toBeNull();
  });

  /**
   * The signature is the whole point: without it the browser could rewrite the
   * state to match whatever an attacker's callback carries, which is exactly
   * the cross-site request the state parameter exists to stop.
   */
  it('refuses a tampered body', () => {
    const sealed = sealTransaction(createOAuthTransaction('/dealer'));
    const [body, signature] = sealed.split('.') as [string, string];
    const edited = Buffer.from(
      JSON.stringify({
        state: 'attacker',
        nonce: 'n',
        codeVerifier: 'v',
        returnTo: '/dealer',
        issuedAt: Date.now(),
      }),
      'utf8',
    ).toString('base64url');

    expect(openTransaction(`${edited}.${signature}`)).toBeNull();
    expect(openTransaction(`${body}.deadbeef`)).toBeNull();
  });

  it.each([['no separator at all'], ['.leading-dot']])('refuses %s', (candidate) => {
    expect(openTransaction(candidate)).toBeNull();
  });

  it('refuses a correctly signed body that is not a transaction', () => {
    // Signed by this very function, so only the *shape* check can reject it.
    const sealed = sealTransaction({ state: 'x' } as never);

    expect(openTransaction(sealed)).toBeNull();
  });

  it('refuses a body that is signed but not JSON', () => {
    const sealed = sealTransaction(createOAuthTransaction('/dealer'));
    const signature = sealed.split('.')[1] as string;
    void signature;

    expect(openTransaction(`bm90LWpzb24.${signature}`)).toBeNull();
  });

  it('refuses a transaction older than its ten minutes', () => {
    const stale = {
      ...createOAuthTransaction('/dealer'),
      issuedAt: Date.now() - (OAUTH_TRANSACTION_TTL_SECONDS + 1) * 1000,
    };

    expect(openTransaction(sealTransaction(stale))).toBeNull();
  });

  it('still accepts one just inside the window', () => {
    const fresh = {
      ...createOAuthTransaction('/dealer'),
      issuedAt: Date.now() - (OAUTH_TRANSACTION_TTL_SECONDS - 5) * 1000,
    };

    expect(openTransaction(sealTransaction(fresh))).not.toBeNull();
  });
});

/**
 * An open redirect on the callback is the classic way an OAuth flow leaks a
 * session: land the victim back on a site the attacker controls, holding a
 * freshly issued cookie.
 */
describe('where a sign-in may land', () => {
  it.each(['/dealer', '/dealer/inventory?status=DRAFT', '/dealer/vehicles/new'])(
    'keeps the same-site path %s',
    (path) => {
      expect(safeReturnTo(path)).toBe(path);
    },
  );

  it.each([
    'https://evil.example.com/steal',
    '//evil.example.com',
    'http://localhost:3000/dealer',
    '/\\evil.example.com',
    '/dealer\nSet-Cookie: x=y',
    '',
    undefined,
  ])('replaces %j with the console', (candidate) => {
    expect(safeReturnTo(candidate)).toBe('/dealer');
  });

  it('honours an explicit fallback', () => {
    expect(safeReturnTo('https://evil.example', '/dealer/onboarding')).toBe('/dealer/onboarding');
  });
});
