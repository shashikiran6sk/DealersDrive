import type { Express } from 'express';
import type { PrismaClient } from '@prisma/client';
import request from 'supertest';

import { buildContainer } from '../src/container.js';
import type {
  AuthorizationRequest,
  OAuthClaims,
  OAuthProvider,
} from '../src/modules/auth/oauth.port.js';
import { UnauthorizedError } from '../src/platform/errors.js';
import { createApp } from '../src/server.js';

/**
 * The sign-in harness — the *real* cookie resolver, with Google replaced.
 *
 * `createHarness` (harness.ts) swaps the whole session resolver out, which is
 * what makes tenant-isolation tests possible but also means it never exercises
 * a cookie. This one keeps every piece of the production path — the transaction
 * cookie, the state check, the `sessions` row, the `dd_session` cookie — and
 * replaces exactly one thing: the provider that would otherwise require a round
 * trip to accounts.google.com.
 *
 * That is the seam `OAuthProvider` exists for. Everything above it, including
 * every security property worth testing, runs unmodified.
 */
export interface FakeGoogle extends OAuthProvider {
  /** The claims the next `exchange` returns. */
  claims: OAuthClaims;
  /** Set to make the next exchange fail the way a bad code does. */
  failWith: UnauthorizedError | null;
  /** What `authorizationUrl` was last asked for. */
  lastRequest: AuthorizationRequest | null;
  exchanges: number;
}

export function createFakeGoogle(claims?: Partial<OAuthClaims>): FakeGoogle {
  const fake: FakeGoogle = {
    id: 'GOOGLE',
    claims: {
      subject: 'google-sub-1',
      email: 'new.dealer@example.com',
      emailVerified: true,
      name: 'New Dealer',
      ...claims,
    },
    failWith: null,
    lastRequest: null,
    exchanges: 0,

    isConfigured: () => true,

    authorizationUrl(authRequest) {
      fake.lastRequest = authRequest;
      const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      url.searchParams.set('state', authRequest.state);
      url.searchParams.set('nonce', authRequest.nonce);
      return url.toString();
    },

    async exchange({ codeVerifier, nonce }) {
      fake.exchanges += 1;
      if (fake.failWith) throw fake.failWith;

      // The real provider proves it holds the verifier and that the identity
      // token carries this browser's nonce. The fake asserts the same two
      // things arrived, so a caller that stopped passing them would fail here
      // rather than silently signing everybody in.
      if (!codeVerifier || !nonce) {
        throw new UnauthorizedError('The exchange was missing PKCE or nonce material.', {
          code: 'OAUTH_EXCHANGE_FAILED',
        });
      }
      return await Promise.resolve(fake.claims);
    },
  };

  return fake;
}

export interface AuthHarness {
  app: Express;
  prisma: PrismaClient;
  google: FakeGoogle;
  agent(): request.Agent;
  /** Drives start → Google → callback on one agent, returning the final redirect. */
  signIn(agent: request.Agent, returnTo?: string): Promise<{ status: number; location: string }>;
  close(): Promise<void>;
}

export async function createAuthHarness(google = createFakeGoogle()): Promise<AuthHarness> {
  const container = await buildContainer({ oauth: google });
  const app = createApp(container);

  return {
    app,
    prisma: container.prisma,
    google,
    agent: () => request.agent(app),

    async signIn(agent, returnTo) {
      const started = await agent
        .get(`/v1/auth/google/start${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ''}`)
        .expect(302);

      // The state is read back out of the URL the browser would have followed —
      // never out of the cookie — because that is the direction Google echoes it.
      const state = new URL(started.headers.location as string).searchParams.get('state') ?? '';
      const callback = await agent.get(`/v1/auth/google/callback?code=auth-code&state=${state}`);

      return { status: callback.status, location: (callback.headers.location as string) ?? '' };
    },

    async close() {
      await container.prisma.$disconnect();
    },
  };
}
