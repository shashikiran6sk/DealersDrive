import type { Express } from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import type { Container } from '../../src/container.js';
import { createApp } from '../../src/server.js';

/**
 * App assembly, and the comment at the top of `server.ts` is the spec: **the
 * middleware order IS the security model.**
 *
 *   1. request-context  — first, so even a body-parser failure carries a traceId
 *   2. helmet / cors    — reject before doing any work
 *   3. body parsers     — bounded, so a huge body cannot exhaust memory
 *   4. request-logger   — after context, so its lines carry the traceId
 *   5. routes
 *   6. not-found        — anything unmatched becomes a NotFoundError
 *   7. error-handler    — last, always
 *
 * Each test below pins one of those positions by producing a request that can
 * only be answered correctly if the order holds. A reordering that looks
 * harmless — moving the body parser above the context, say — shows up here as
 * a problem document with no traceId.
 *
 * ── Reconstruction note ───────────────────────────────────────────────────
 * Positions 6 and 7 do not exist yet, so the describes that pin them are not
 * here either. They come back with the features that add the middleware:
 *
 *   'not-found sits after the routes'   → F003
 *   'the error handler sits last'       → F003
 *   the 413 `code` and malformed-JSON cases in 'the body parsers' → F003,
 *     which is what turns an Express default error into a problem document
 *   'stamps one on a body-parser failure' → F003, for the same reason: the
 *     traceId reaches the response *body* only once the error handler renders
 *     the problem document. The header is asserted here already.
 */

function app(): Express {
  return createApp({} as unknown as Container);
}

describe('assembly', () => {
  it('returns an express app without listening on a port', () => {
    expect(typeof app()).toBe('function');
  });

  /** So `x-powered-by: Express` does not tell a scanner what to look up. */
  it('does not announce the framework', async () => {
    const response = await request(app()).get('/health/live');

    expect(response.headers['x-powered-by']).toBeUndefined();
  });

  /**
   * Exactly one hop, not `true`. Trusting every hop lets a client forge
   * `X-Forwarded-For` and become a new IP for every rate-limited request.
   */
  it('trusts exactly one proxy hop', () => {
    expect(app().get('trust proxy')).toBe(1);
  });
});

describe('the request context comes first', () => {
  it('stamps a traceId header on a successful response', async () => {
    const response = await request(app()).get('/health/live');

    expect(response.headers['x-trace-id']).toMatch(/^[\w-]{10}$/);
  });

  it('stamps one on a 404 too', async () => {
    const response = await request(app()).get('/v1/nope');

    expect(response.headers['x-trace-id']).toBeDefined();
  });

  it('gives each request its own traceId', async () => {
    const one = await request(app()).get('/health/live');
    const two = await request(app()).get('/health/live');

    expect(one.headers['x-trace-id']).not.toBe(two.headers['x-trace-id']);
  });
});

describe('security headers', () => {
  it('sets the helmet defaults', async () => {
    const response = await request(app()).get('/health/live');

    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-frame-options']).toBeDefined();
  });

  it('answers a preflight from an allowed origin', async () => {
    const response = await request(app())
      .options('/v1/vehicles')
      .set('Origin', 'http://localhost:3000')
      .set('Access-Control-Request-Method', 'GET');

    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3000');
  });

  /** Credentialed CORS is why the origin list is explicit rather than `*`. */
  it('allows credentials, and therefore names the origin explicitly', async () => {
    const response = await request(app())
      .get('/v1/vehicles')
      .set('Origin', 'http://localhost:3000');

    expect(response.headers['access-control-allow-credentials']).toBe('true');
    expect(response.headers['access-control-allow-origin']).not.toBe('*');
  });

  it('does not hand an allow-origin to an unlisted site', async () => {
    const response = await request(app())
      .get('/v1/vehicles')
      .set('Origin', 'https://a-scraper.example');

    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });
});

describe('the body parsers', () => {
  it('parses JSON into req.body', async () => {
    const response = await request(app()).post('/v1/enquiries').send({ name: 'A' });

    // Reaches validation rather than failing to parse.
    expect(response.status).not.toBe(415);
  });

  /**
   * Bounded so one request cannot exhaust the process's memory. F003 adds the
   * assertion that this is rendered as a `PAYLOAD_TOO_LARGE` problem document
   * rather than whatever Express produces by default.
   */
  it('refuses a body over the limit with 413, not a 500', async () => {
    const response = await request(app())
      .post('/v1/enquiries')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ message: 'x'.repeat(2 * 1024 * 1024) }));

    expect(response.status).toBe(413);
  });
});
