import type { Server } from 'node:http';

import type { Express } from 'express';
import type { PrismaClient } from '@prisma/client';
import request from 'supertest';

import { env } from '../src/config/env.js';
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
  /**
   * The listening server every agent dials (**R39**).
   *
   * Held open for the file's whole run on purpose. `request(app)` calls
   * `app.listen(0)` when the app is not already listening and closes it again
   * when the request ends, which means one listen/close **per request** and a
   * port handed back to the operating system each time. On a workstation with
   * other long-lived servers on it, one of them can take a port the suite has
   * just released — and the next request then dials somebody else's process and
   * gets an answer that is not this API's at all. That is the intermittent
   * integration failure `CONTEXT.md` §7l describes; listening once removes the
   * churn it needs.
   */
  server: Server;
  prisma: PrismaClient;
  google: FakeGoogle;
  agent(): request.Agent;
  /** Drives start → Google → callback on one agent, returning the final redirect. */
  signIn(agent: request.Agent, returnTo?: string): Promise<{ status: number; location: string }>;
  /**
   * Proves a mobile number the way step 1 does (**R39**).
   *
   * `POST /v1/auth/onboarding` refuses a number this session has not verified,
   * so nearly every fixture below has to walk through this first. It is the
   * real endpoint on the real `fake` driver — no row is written by hand —
   * which means the gate is exercised by every test that passes through it
   * rather than only by the two that are about it.
   */
  proveNumber(agent: request.Agent, phone: string): Promise<void>;
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

/** Makes each development token unique — see `proveNumber`. */
let proofs = 0;

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
  // One listener for the whole file — see `AuthHarness.server`.
  const server = app.listen(0);

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
    server,
    prisma: container.prisma,
    google,
    mailer,
    drainEmails: () => container.outbox.drain(),
    agent: () => request.agent(server),

    signIn: (agent, returnTo) => roundTrip(agent, '/v1/auth/google/start', returnTo),

    async proveNumber(agent, phone) {
      const digits = phone.replace(/\D/g, '').slice(-10);
      proofs += 1;
      await agent
        .post('/v1/auth/phone/verify')
        /*
         * The documented development token shape — see
         * `src/platform/phone-otp/fake.adapter.ts`. The trailing counter makes
         * each one unique: the service remembers a token for fifteen minutes
         * so it cannot be replayed, and a suite that sent the same string
         * twice would be refused for that reason rather than for anything it
         * was trying to assert.
         */
        .send({
          phone,
          accessToken: `dev-otp:91${digits}:${env.PHONE_OTP_DEV_CODE}:${String(proofs)}`,
        })
        .expect(200);
    },

    signInAdmin: (agent, returnTo) => roundTrip(agent, '/v1/auth/admin/google/start', returnTo),

    async close() {
      await new Promise<void>((resolve) =>
        server.close(() => {
          resolve();
        }),
      );
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
