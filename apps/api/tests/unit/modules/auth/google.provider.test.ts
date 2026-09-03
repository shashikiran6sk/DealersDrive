import { afterEach, describe, expect, it, vi } from 'vitest';

import { UnauthorizedError } from '../../../../src/platform/errors.js';

/**
 * The one file that talks to Google, tested without talking to Google.
 *
 * What matters here is not that a happy path works — the integration suite
 * proves the flow end to end with the provider replaced. What matters is every
 * way a *hostile or broken* response is refused, because this function is where
 * an attacker's forged identity would have to get through.
 *
 * The identity token's signature is deliberately not checked (OIDC Core
 * §3.1.3.7 item 6: it arrived over TLS from Google's own token endpoint, in a
 * response to a request this process made with a client secret). Every other
 * claim is, and those checks are what these tests pin.
 */
const CLIENT_ID = 'client.apps.googleusercontent.com';
const NONCE = 'the-nonce';

/**
 * `env` is frozen at import, so the credentials have to exist *before* the
 * module graph is built — hence the top-level await rather than an ordinary
 * import. Reading `process.env` anywhere but `config/env.ts` is a bug; this
 * file writes it, which is the only way to test a different configuration.
 */
process.env.GOOGLE_CLIENT_ID = CLIENT_ID;
process.env.GOOGLE_CLIENT_SECRET = 'client-secret';

const { createGoogleOAuthProvider } =
  await import('../../../../src/modules/auth/google.provider.js');

function idToken(claims: Record<string, unknown>): string {
  const payload = Buffer.from(JSON.stringify(claims), 'utf8').toString('base64url');
  return `header.${payload}.signature`;
}

function validClaims(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    iss: 'https://accounts.google.com',
    aud: CLIENT_ID,
    sub: '1029384756',
    exp: Math.floor(Date.now() / 1000) + 600,
    nonce: NONCE,
    email: 'Dealer@Example.com',
    email_verified: true,
    name: 'A Dealer',
    picture: 'https://lh3.googleusercontent.com/a/abc',
    ...overrides,
  };
}

function respondWith(body: unknown, status = 200): typeof fetch {
  return vi.fn(() =>
    Promise.resolve(
      new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
    ),
  );
}

function exchange(body: unknown, status = 200) {
  return createGoogleOAuthProvider(respondWith(body, status)).exchange({
    code: 'auth-code',
    codeVerifier: 'verifier',
    nonce: NONCE,
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('the authorization URL', () => {
  const provider = createGoogleOAuthProvider();

  const url = new URL(
    provider.authorizationUrl({ state: 'the-state', nonce: NONCE, codeVerifier: 'verifier' }),
  );

  it('points at Google with the authorization code flow', () => {
    expect(url.origin).toBe('https://accounts.google.com');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('client_id')).toBe(CLIENT_ID);
  });

  it('asks only for identity, not for a mailbox or a drive', () => {
    expect(url.searchParams.get('scope')).toBe('openid email profile');
  });

  it('carries the state and the nonce it was given', () => {
    expect(url.searchParams.get('state')).toBe('the-state');
    expect(url.searchParams.get('nonce')).toBe(NONCE);
  });

  /**
   * PKCE (RFC 7636 §4.2): the challenge is the SHA-256 of the verifier, so the
   * verifier itself never travels through the browser.
   */
  it('sends the S256 challenge and never the verifier', () => {
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('code_challenge')).toBe(
      // BASE64URL(SHA256('verifier'))
      'iMnq5o6zALKXGivsnlom_0F5_WYda32GHkxlV7mq7hQ',
    );
    expect(url.toString()).not.toContain('verifier');
  });

  /** No refresh token is wanted: the application session outlives the sign-in. */
  it('asks for online access and the account chooser', () => {
    expect(url.searchParams.get('access_type')).toBe('online');
    expect(url.searchParams.get('prompt')).toBe('select_account');
  });

  it('reports whether the deployment can perform a sign-in', () => {
    expect(provider.isConfigured()).toBe(true);
  });
});

describe('a successful exchange', () => {
  it('returns the verified claims', async () => {
    const claims = await exchange({ id_token: idToken(validClaims()) });

    expect(claims).toEqual({
      subject: '1029384756',
      email: 'dealer@example.com',
      emailVerified: true,
      name: 'A Dealer',
      picture: 'https://lh3.googleusercontent.com/a/abc',
    });
  });

  /** Addresses are compared elsewhere; casing must not make two of one account. */
  it('lower-cases the email', async () => {
    const claims = await exchange({ id_token: idToken(validClaims({ email: 'MiXeD@Case.IN' })) });

    expect(claims.email).toBe('mixed@case.in');
  });

  it('omits the optional profile fields rather than inventing them', async () => {
    const claims = await exchange({
      id_token: idToken(validClaims({ name: undefined, picture: undefined })),
    });

    expect(claims.name).toBeUndefined();
    expect(claims.picture).toBeUndefined();
  });

  it('sends the code, the verifier and the client secret to the token endpoint', async () => {
    const fetchImpl = respondWith({ id_token: idToken(validClaims()) });
    await createGoogleOAuthProvider(fetchImpl).exchange({
      code: 'auth-code',
      codeVerifier: 'verifier',
      nonce: NONCE,
    });

    const [url, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit,
    ];
    const body = new URLSearchParams(typeof init.body === 'string' ? init.body : '');

    expect(url).toBe('https://oauth2.googleapis.com/token');
    expect(body.get('grant_type')).toBe('authorization_code');
    expect(body.get('code')).toBe('auth-code');
    expect(body.get('code_verifier')).toBe('verifier');
    expect(body.get('client_secret')).toBe('client-secret');
  });
});

describe('what it refuses', () => {
  async function rejects(body: unknown, status = 200): Promise<UnauthorizedError> {
    return (await exchange(body, status).catch((error: unknown) => error)) as UnauthorizedError;
  }

  it('refuses a token endpoint error', async () => {
    const error = await rejects({ error: 'invalid_grant' }, 400);

    expect(error).toBeInstanceOf(UnauthorizedError);
    expect(error.code).toBe('OAUTH_EXCHANGE_FAILED');
  });

  it('refuses a 200 with no identity token', async () => {
    expect((await rejects({ access_token: 'only-this' })).code).toBe('OAUTH_EXCHANGE_FAILED');
  });

  it('refuses a response that is not JSON at all', async () => {
    const fetchImpl = vi.fn(() =>
      Promise.resolve(new Response('<html>502</html>', { status: 502 })),
    ) as unknown as typeof fetch;

    await expect(
      createGoogleOAuthProvider(fetchImpl).exchange({
        code: 'c',
        codeVerifier: 'v',
        nonce: NONCE,
      }),
    ).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it.each([
    ['a token that is not three segments', 'not.a.jwt.at.all'],
    ['a payload that is not JSON', 'header.bm90LWpzb24.signature'],
  ])('refuses %s', async (_label, token) => {
    expect((await rejects({ id_token: token })).code).toBe('OAUTH_IDENTITY_INVALID');
  });

  /** An identity token from another issuer is not an identity here. */
  it('refuses another issuer', async () => {
    const error = await rejects({
      id_token: idToken(validClaims({ iss: 'https://evil.example' })),
    });

    expect(error.code).toBe('OAUTH_IDENTITY_INVALID');
    expect(error.detail).toContain('not issued by Google');
  });

  it('accepts the bare-host issuer Google also uses', async () => {
    const claims = await exchange({
      id_token: idToken(validClaims({ iss: 'accounts.google.com' })),
    });

    expect(claims.subject).toBe('1029384756');
  });

  /**
   * The audience check is what stops a token minted for *another* application
   * — one the attacker controls — from signing them in here.
   */
  it('refuses a token issued for another application', async () => {
    const error = await rejects({ id_token: idToken(validClaims({ aud: 'someone-else' })) });

    expect(error.detail).toContain('another application');
  });

  it('refuses an expired token', async () => {
    const error = await rejects({
      id_token: idToken(validClaims({ exp: Math.floor(Date.now() / 1000) - 3600 })),
    });

    expect(error.detail).toContain('expired');
  });

  it('allows a minute of clock skew', async () => {
    const claims = await exchange({
      id_token: idToken(validClaims({ exp: Math.floor(Date.now() / 1000) - 5 })),
    });

    expect(claims.subject).toBe('1029384756');
  });

  /** The nonce ties the token to *this* browser's sign-in. */
  it('refuses a token minted for a different sign-in', async () => {
    const error = await rejects({ id_token: idToken(validClaims({ nonce: 'someone-elses' })) });

    expect(error.code).toBe('OAUTH_IDENTITY_INVALID');
  });

  it('refuses a token with no subject', async () => {
    expect((await rejects({ id_token: idToken(validClaims({ sub: undefined })) })).code).toBe(
      'OAUTH_IDENTITY_INVALID',
    );
  });

  it('refuses an account that shared no email address', async () => {
    const error = await rejects({ id_token: idToken(validClaims({ email: undefined })) });

    expect(error.detail).toContain('email address');
  });

  /**
   * An unverified Google email is an address someone typed, not one Google
   * checked — and the whole identity model here rests on Google having checked.
   */
  it('refuses an unverified email', async () => {
    const error = await rejects({ id_token: idToken(validClaims({ email_verified: false })) });

    expect(error.detail).toContain('not verified');
  });

  it('refuses a missing email_verified claim, rather than assuming it', async () => {
    expect(
      (await rejects({ id_token: idToken(validClaims({ email_verified: undefined })) })).code,
    ).toBe('OAUTH_IDENTITY_INVALID');
  });
});

describe('without credentials', () => {
  /**
   * Blank, not deleted.
   *
   * `config/env.ts` calls `dotenv.config()` when it is imported, and dotenv
   * fills in any variable that is *unset* — so deleting this one and
   * re-importing the module reads it straight back out of the developer's own
   * `.env`, and the test passes only for someone who has never configured
   * Google sign-in. Blank is present, so dotenv leaves it alone, and `env.ts`
   * already treats an empty string as unset (`optional()`), which is the state
   * this test is about.
   */
  it('reports that it cannot sign anybody in', async () => {
    process.env.GOOGLE_CLIENT_ID = '';
    vi.resetModules();
    try {
      const module = await import('../../../../src/modules/auth/google.provider.js');

      expect(module.createGoogleOAuthProvider().isConfigured()).toBe(false);
    } finally {
      process.env.GOOGLE_CLIENT_ID = CLIENT_ID;
      vi.resetModules();
    }
  });
});
