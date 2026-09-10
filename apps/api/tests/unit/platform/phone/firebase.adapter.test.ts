import { createSign, generateKeyPairSync } from 'node:crypto';

import { beforeAll, describe, expect, it, vi } from 'vitest';

import { createFirebasePhoneVerifier } from '../../../../src/platform/phone/firebase.adapter.js';

/**
 * The Firebase ID token verifier (**R39**), against real cryptography and no
 * network.
 *
 * ── Why this shape of test ──────────────────────────────────────────────────
 * A phone-verification test that needs an SMS is a test nobody runs. So the
 * suite generates its own RSA key pair, signs tokens with it, and primes the
 * public half as the "certificate" Google would have published:
 * `createPublicKey` accepts an SPKI public key and an X.509 certificate alike,
 * so the code under test is the production code, unmodified, and the only thing
 * faked is *whose* key it is.
 *
 * What that buys is the ability to assert on forgeries. Every case below is a
 * token that is wrong in exactly one way — a swapped algorithm, another
 * project's audience, a sign-in that was not by phone, a code entered last
 * month — and each one has to be refused. A mocked verifier could not fail any
 * of them, which is precisely why this file exists rather than a stub.
 */
const PROJECT = 'dealers-drive-test';
const KID = 'test-kid-1';
const PHONE = '+919840012345';

let privateKey: string;
let publicKey: string;

beforeAll(() => {
  const pair = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  privateKey = pair.privateKey;
  publicKey = pair.publicKey;
});

function base64url(value: object): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

interface TokenOverrides {
  header?: Record<string, unknown>;
  claims?: Record<string, unknown>;
  signWith?: string;
  signature?: string;
}

function token(overrides: TokenOverrides = {}): string {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', kid: KID, typ: 'JWT', ...overrides.header };
  const claims = {
    iss: `https://securetoken.google.com/${PROJECT}`,
    aud: PROJECT,
    sub: 'firebase-uid-1',
    iat: now,
    exp: now + 3600,
    auth_time: now,
    phone_number: PHONE,
    firebase: { sign_in_provider: 'phone' },
    ...overrides.claims,
  };

  const signed = `${base64url(header)}.${base64url(claims)}`;
  if (overrides.signature !== undefined) return `${signed}.${overrides.signature}`;

  const signer = createSign('RSA-SHA256');
  signer.update(signed);
  signer.end();
  return `${signed}.${signer.sign(overrides.signWith ?? privateKey).toString('base64url')}`;
}

/** Fails the test if it is called: every case below should be served from cache. */
const noFetch = vi.fn(() =>
  Promise.reject(new Error('unexpected network call')),
) as unknown as typeof fetch;

function verifier(maxAgeSeconds = 600) {
  const made = createFirebasePhoneVerifier(noFetch, { projectId: PROJECT, maxAgeSeconds });
  made.primeCerts({ [KID]: publicKey });
  return made;
}

describe('a token Google actually signed', () => {
  it('returns the number, the provider id and when the code was entered', async () => {
    const verified = await verifier().verify(token());

    expect(verified.phone).toBe(PHONE);
    expect(verified.providerUserId).toBe('firebase-uid-1');
    expect(verified.authenticatedAt.getTime()).toBeLessThanOrEqual(Date.now() + 1000);
  });

  it('names itself, for the health payload and the boot log', () => {
    expect(verifier().driver).toBe('firebase');
  });
});

describe('forgeries', () => {
  /**
   * The classic JWT vulnerability, in two forms. A library that reads the
   * algorithm out of the token and obliges will accept `none` with no signature
   * at all, and will accept `HS256` with the *public* certificate used as an
   * HMAC secret — which is public. `alg` is therefore checked before the key is
   * touched, and only RS256 passes.
   */
  it.each([['none'], ['HS256'], ['RS512']])('refuses alg=%s', async (alg) => {
    await expect(verifier().verify(token({ header: { alg } }))).rejects.toMatchObject({
      status: 401,
      code: 'PHONE_TOKEN_INVALID',
    });
  });

  it('refuses a token with no kid', async () => {
    await expect(verifier().verify(token({ header: { kid: undefined } }))).rejects.toMatchObject({
      code: 'PHONE_TOKEN_INVALID',
    });
  });

  it('refuses a signature made with a different key', async () => {
    const other = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });

    await expect(verifier().verify(token({ signWith: other.privateKey }))).rejects.toMatchObject({
      code: 'PHONE_TOKEN_INVALID',
    });
  });

  it('refuses a signature that is not a signature', async () => {
    await expect(verifier().verify(token({ signature: 'not-a-signature' }))).rejects.toMatchObject({
      code: 'PHONE_TOKEN_INVALID',
    });
  });

  it.each([['two.parts'], ['a.b.c.d'], ['']])('refuses a malformed token (%s)', async (raw) => {
    await expect(verifier().verify(raw)).rejects.toMatchObject({ code: 'PHONE_TOKEN_INVALID' });
  });

  it('refuses a token whose payload is not JSON', async () => {
    const raw = `${Buffer.from(JSON.stringify({ alg: 'RS256', kid: KID })).toString('base64url')}.not-json.sig`;

    await expect(verifier().verify(raw)).rejects.toMatchObject({ code: 'PHONE_TOKEN_INVALID' });
  });

  /**
   * **The check that matters most.** Anyone can create a Firebase project in
   * two minutes, sign in to it by phone, and get a token signed by the same
   * Google certificates this verifier trusts. `aud` is the only thing that says
   * the token was minted for *us*, and without it the whole endpoint is an
   * open door with a padlock drawn on it.
   */
  it('refuses a token minted for another Firebase project', async () => {
    await expect(
      verifier().verify(token({ claims: { aud: 'somebody-elses-project' } })),
    ).rejects.toMatchObject({ code: 'PHONE_TOKEN_INVALID' });
  });

  it('refuses a token from another issuer', async () => {
    await expect(
      verifier().verify(token({ claims: { iss: 'https://accounts.google.com' } })),
    ).rejects.toMatchObject({ code: 'PHONE_TOKEN_INVALID' });
  });

  it('refuses a token with no subject', async () => {
    await expect(verifier().verify(token({ claims: { sub: '' } }))).rejects.toMatchObject({
      code: 'PHONE_TOKEN_INVALID',
    });
  });

  /**
   * A Firebase project holds accounts signed in by email, by Google and
   * anonymously, and every one of them mints a token against the same project
   * with the same `aud`. None of those proves a handset; an anonymous one
   * proves nothing at all.
   */
  it.each([['password'], ['google.com'], ['anonymous']])(
    'refuses a sign-in by %s rather than by phone',
    async (provider) => {
      await expect(
        verifier().verify(token({ claims: { firebase: { sign_in_provider: provider } } })),
      ).rejects.toMatchObject({ code: 'PHONE_TOKEN_INVALID' });
    },
  );

  it.each([[undefined], ['9840012345'], ['not-a-number'], ['+0123']])(
    'refuses a phone_number of %s',
    async (phone) => {
      await expect(
        verifier().verify(token({ claims: { phone_number: phone } })),
      ).rejects.toMatchObject({ code: 'PHONE_TOKEN_INVALID' });
    },
  );

  it('refuses a token issued in the future', async () => {
    const future = Math.floor(Date.now() / 1000) + 3600;

    await expect(verifier().verify(token({ claims: { iat: future } }))).rejects.toMatchObject({
      code: 'PHONE_TOKEN_INVALID',
    });
  });
});

describe('freshness', () => {
  /**
   * Expiry gets its own code, and the reason is the dealer rather than the
   * attacker: "your code has expired, send another" is actionable, and calling
   * a stale code *invalid* sends somebody hunting for a typo that is not there.
   */
  it('separates an expired token from an invalid one', async () => {
    const past = Math.floor(Date.now() / 1000) - 7200;

    await expect(verifier().verify(token({ claims: { exp: past } }))).rejects.toMatchObject({
      status: 401,
      code: 'PHONE_TOKEN_EXPIRED',
    });
  });

  /**
   * **`auth_time`, not `iat`** — the check a naive implementation gets wrong.
   *
   * A Firebase ID token can be refreshed for a year off one sign-in, so `iat`
   * is only when the browser last asked for a fresh copy. This token is
   * therefore perfectly current by `iat` and `exp`, and is still refused:
   * nobody has held that handset in an hour.
   */
  it('refuses a current token whose code was entered too long ago', async () => {
    const now = Math.floor(Date.now() / 1000);

    await expect(
      verifier(600).verify(token({ claims: { iat: now, exp: now + 3600, auth_time: now - 3600 } })),
    ).rejects.toMatchObject({ code: 'PHONE_TOKEN_EXPIRED' });
  });

  it('accepts one entered inside the window', async () => {
    const now = Math.floor(Date.now() / 1000);

    const verified = await verifier(600).verify(token({ claims: { auth_time: now - 120 } }));

    expect(verified.phone).toBe(PHONE);
  });

  it('refuses a token with no auth_time at all', async () => {
    await expect(
      verifier().verify(token({ claims: { auth_time: undefined } })),
    ).rejects.toMatchObject({ code: 'PHONE_TOKEN_EXPIRED' });
  });
});

describe("Google's certificates", () => {
  function respond(body: unknown, cacheControl = 'public, max-age=19052') {
    return vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(body),
        headers: { get: (name: string) => (name === 'cache-control' ? cacheControl : null) },
      } as unknown as Response),
    );
  }

  it('fetches them once and serves the rest from cache', async () => {
    const fetchImpl = respond({ [KID]: publicKey });
    const made = createFirebasePhoneVerifier(fetchImpl, { projectId: PROJECT });

    await made.verify(token());
    await made.verify(token());

    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  /**
   * An unknown `kid` is the normal shape of a key rotation rather than an
   * attack: Google published a new key and the cache predates it. One forced
   * refresh answers that — and a second unknown `kid` is a token to refuse.
   */
  it('refreshes once on an unknown kid, then gives up', async () => {
    const fetchImpl = respond({ 'some-other-kid': publicKey });
    const made = createFirebasePhoneVerifier(fetchImpl, { projectId: PROJECT });

    await expect(made.verify(token())).rejects.toMatchObject({ code: 'PHONE_TOKEN_INVALID' });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  /**
   * Google being unreachable is a 503, not a 401. The difference is what an
   * operator does next: a 401 sends them looking for a bad token, and a 503
   * says the dealer should try again in a moment.
   */
  it('answers a failed fetch with an upstream error rather than a refusal', async () => {
    const fetchImpl = vi.fn(() =>
      Promise.resolve({ ok: false, status: 503 } as unknown as Response),
    ) as unknown as typeof fetch;
    const made = createFirebasePhoneVerifier(fetchImpl, { projectId: PROJECT });

    await expect(made.verify(token())).rejects.toMatchObject({
      status: 503,
      code: 'PHONE_VERIFICATION_UNAVAILABLE',
    });
  });

  /** A burst past the cache expiry must fetch once, not once per request. */
  it('collapses a stampede into one fetch', async () => {
    const fetchImpl = respond({ [KID]: publicKey });
    const made = createFirebasePhoneVerifier(fetchImpl, { projectId: PROJECT });

    await Promise.all([made.verify(token()), made.verify(token()), made.verify(token())]);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('falls back to a sane cache lifetime when the header says nothing', async () => {
    const fetchImpl = respond({ [KID]: publicKey }, '');
    const made = createFirebasePhoneVerifier(fetchImpl, { projectId: PROJECT });

    await made.verify(token());
    await made.verify(token());

    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
