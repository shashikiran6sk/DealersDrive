import { createHash } from 'node:crypto';

import { googleCredentials, isGoogleConfigured } from '../../config/env.js';
import { UnauthorizedError } from '../../platform/errors.js';
import type { AuthorizationRequest, OAuthClaims, OAuthProvider } from './oauth.port.js';

const AUTHORIZATION_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const ISSUERS = new Set(['https://accounts.google.com', 'accounts.google.com']);

const LEEWAY_SECONDS = 60;

interface TokenResponse {
  id_token?: string;
  access_token?: string;
  error?: string;
  error_description?: string;
}

interface IdTokenClaims {
  iss?: string;
  aud?: string;
  sub?: string;
  exp?: number;
  nonce?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
}

export function createGoogleOAuthProvider(fetchImpl: typeof fetch = fetch): OAuthProvider {
  return {
    id: 'GOOGLE',

    isConfigured: isGoogleConfigured,

    authorizationUrl(request: AuthorizationRequest): string {
      const { clientId, callbackUrl } = googleCredentials();
      const url = new URL(AUTHORIZATION_ENDPOINT);

      url.searchParams.set('client_id', clientId);
      url.searchParams.set('redirect_uri', callbackUrl);
      url.searchParams.set('response_type', 'code');
      url.searchParams.set('scope', 'openid email profile');
      url.searchParams.set('state', request.state);
      url.searchParams.set('nonce', request.nonce);
      url.searchParams.set('code_challenge', challengeFor(request.codeVerifier));
      url.searchParams.set('code_challenge_method', 'S256');
      url.searchParams.set('access_type', 'online');
      url.searchParams.set('prompt', request.prompt ?? 'select_account');

      return url.toString();
    },

    async exchange({ code, codeVerifier, nonce }): Promise<OAuthClaims> {
      const { clientId, clientSecret, callbackUrl } = googleCredentials();

      const response = await fetchImpl(TOKEN_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: callbackUrl,
          grant_type: 'authorization_code',
          code_verifier: codeVerifier,
        }).toString(),
      });

      const payload = (await response.json().catch(() => null)) as TokenResponse | null;

      if (!response.ok || !payload?.id_token) {
        throw new UnauthorizedError('Google could not verify that sign-in. Please try again.', {
          code: 'OAUTH_EXCHANGE_FAILED',
          cause: payload?.error_description ?? payload?.error,
        });
      }

      return claimsFrom(decodeIdToken(payload.id_token), { clientId, nonce });
    },
  };
}

function decodeIdToken(idToken: string): IdTokenClaims {
  const segments = idToken.split('.');
  const payload = segments[1];

  if (segments.length !== 3 || !payload) {
    throw new UnauthorizedError('Google returned an identity token this API cannot read.', {
      code: 'OAUTH_IDENTITY_INVALID',
    });
  }

  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as IdTokenClaims;
  } catch (cause) {
    throw new UnauthorizedError('Google returned an identity token this API cannot read.', {
      code: 'OAUTH_IDENTITY_INVALID',
      cause,
    });
  }
}

function claimsFrom(
  claims: IdTokenClaims,
  expected: { clientId: string; nonce: string },
): OAuthClaims {
  const reject = (detail: string): never => {
    throw new UnauthorizedError(detail, { code: 'OAUTH_IDENTITY_INVALID' });
  };

  if (!claims.iss || !ISSUERS.has(claims.iss)) reject('That identity was not issued by Google.');
  if (claims.aud !== expected.clientId) reject('That identity was issued for another application.');
  if (!claims.exp || claims.exp + LEEWAY_SECONDS < Math.floor(Date.now() / 1000)) {
    reject('That sign-in has expired. Please try again.');
  }
  if (claims.nonce !== expected.nonce)
    reject('That sign-in could not be verified. Please try again.');
  if (!claims.sub) reject('Google did not return an account identifier.');

  if (!claims.email) {
    reject('Your Google account did not share an email address, which Dealers-Drive needs.');
  }
  if (claims.email_verified !== true) {
    reject('Your Google account email is not verified. Verify it with Google, then sign in again.');
  }

  return {
    subject: claims.sub as string,
    email: (claims.email as string).toLowerCase(),
    emailVerified: true,
    ...(claims.name === undefined ? {} : { name: claims.name }),
    ...(claims.picture === undefined ? {} : { picture: claims.picture }),
  };
}

function challengeFor(codeVerifier: string): string {
  return createHash('sha256').update(codeVerifier).digest('base64url');
}
