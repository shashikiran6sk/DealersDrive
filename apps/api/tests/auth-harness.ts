import type { Express } from 'express';
import type { PrismaClient } from '@prisma/client';
import request from 'supertest';

import { buildContainer } from '../src/container.js';
import type {
  AuthorizationRequest,
  OAuthClaims,
  OAuthProvider,
} from '../src/modules/auth/oauth.port.js';
import { noMapsLookup } from '../src/platform/maps/maps-link.js';
import type { MailMessage, MailerPort } from '../src/platform/mail/mail.port.js';
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
  /**
   * The same round trip entered from the admin console's button.
   *
   * One method rather than a flag, because the difference is the *start* URL —
   * which is the whole mechanism: the audience is sealed there, and the shared
   * callback reads it back out of the cookie.
   */
  signInAdmin(
    agent: request.Agent,
    returnTo?: string,
  ): Promise<{ status: number; location: string }>;
  /** Every email the run has produced, in order (**R40**). */
  mailer: RecordingMailer;
  /**
   * Publishes whatever the last write put in the outbox, then returns.
   *
   * The suite's stand-in for the worker's poller: the queue is inline, so
   * draining a row runs the subscriber, the job and the send synchronously.
   */
  drainEmails(): Promise<number>;
  close(): Promise<void>;
}

/**
 * A mailer that records instead of sending (**R40**).
 *
 * Not `console`, which would only log: a test has to be able to say *who was
 * written to, about what*. Everything above it — the subscribers, the
 * idempotency claim, the delivery row — is the production path.
 */
export function createRecordingMailer(): RecordingMailer {
  const sent: MailMessage[] = [];
  return {
    driver: 'console',
    sent,
    send(message) {
      sent.push(message);
      return Promise.resolve({ providerMessageId: `recorded-${String(sent.length)}` });
    },
  };
}

export interface RecordingMailer extends MailerPort {
  readonly sent: MailMessage[];
}

export async function createAuthHarness(
  google = createFakeGoogle(),
  mailer: RecordingMailer = createRecordingMailer(),
): Promise<AuthHarness> {
  /*
   * No Maps lookup, for the same reason the OAuth provider above is a fake:
   * a suite that reaches the internet is a suite whose result depends on the
   * network it runs on. `noMapsLookup` answers null, which is a real state —
   * a dealership whose share link could not be followed to a pin — so the
   * onboarding cases below exercise a shape the product has rather than a
   * disabled one.
   */
  const container = await buildContainer({ oauth: google, maps: noMapsLookup, mailer });
  const app = createApp(container);

  /*
   * **R40.** The suite is its own worker.
   *
   * `JOBS_ENABLED=false` makes the queue inline, so a job runs on `send`; what
   * is missing is the outbox drain, which in production is a poller. Wiring the
   * subscribers here and exposing `drainEmails()` lets a test assert on the
   * email a write produced *on the next line*, with no sleep and no background
   * timer against the test database.
   *
   * Everything above the drain is production code: the same subscribers, the
   * same handler, the same idempotency claim. Only the poller is replaced.
   */
  container.notifications.subscribe(container.bus);
  await container.notifications.work();

  return {
    app,
    prisma: container.prisma,
    google,
    mailer,
    drainEmails: () => container.outbox.drain(),
    agent: () => request.agent(app),

    signIn: (agent, returnTo) => roundTrip(agent, '/v1/auth/google/start', returnTo),
    signInAdmin: (agent, returnTo) => roundTrip(agent, '/v1/auth/admin/google/start', returnTo),

    async close() {
      await container.prisma.$disconnect();
    },
  };

  async function roundTrip(
    agent: request.Agent,
    startPath: string,
    returnTo?: string,
  ): Promise<{ status: number; location: string }> {
    const started = await agent
      .get(`${startPath}${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ''}`)
      .expect(302);

    // The state is read back out of the URL the browser would have followed —
    // never out of the cookie — because that is the direction Google echoes it.
    const state = new URL(started.headers.location as string).searchParams.get('state') ?? '';
    const callback = await agent.get(`/v1/auth/google/callback?code=auth-code&state=${state}`);

    return { status: callback.status, location: (callback.headers.location as string) ?? '' };
  }
}
