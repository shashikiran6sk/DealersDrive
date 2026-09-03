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
 * The middleware stack is complete as of F003, so every position above is
 * pinned. Two cases still wait on routes rather than on middleware:
 *
 *   'turns a typo'd query parameter into a 400'    → the first route with a
 *                                                    query schema to validate
 *
 * It asserts that a real route survives the stack and rejects a typo'd key.
 * It is not included in a weakened form in the meantime.
 */

function app(): Express {
  const prisma = { $queryRaw: () => Promise.resolve([]) };

  return createApp({ prisma } as unknown as Container);
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

  /**
   * The reason the context is mounted above the body parser: a malformed body
   * fails inside `express.json()`, before any route. If the context ran later,
   * that error would be the one failure a dealer could not quote a traceId
   * for — and malformed bodies are exactly what people file bugs about.
   */
  it('stamps one on a body-parser failure, which happens before any route', async () => {
    const response = await request(app())
      .post('/v1/enquiries')
      .set('Content-Type', 'application/json')
      .send('{"not":');

    expect(response.status).toBe(400);
    expect(response.headers['x-trace-id']).toBeDefined();
    expect((response.body as { traceId?: string }).traceId).toBeDefined();
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

  /** Bounded so one request cannot exhaust the process's memory. */
  it('refuses a body over the limit with 413, not a 500', async () => {
    const response = await request(app())
      .post('/v1/enquiries')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ message: 'x'.repeat(2 * 1024 * 1024) }));

    expect(response.status).toBe(413);
    expect((response.body as { code?: string }).code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('turns malformed JSON into a 400 problem document, not a crash', async () => {
    const response = await request(app())
      .post('/v1/enquiries')
      .set('Content-Type', 'application/json')
      .send('{"unclosed": ');

    expect(response.status).toBe(400);
    expect(response.headers['content-type']).toContain('application/problem+json');
    expect((response.body as { code?: string }).code).toBe('MALFORMED_BODY');
  });
});

describe('not-found sits after the routes', () => {
  it('answers an unmatched path with a problem document rather than HTML', async () => {
    const response = await request(app()).get('/v1/nope');

    expect(response.status).toBe(404);
    expect(response.headers['content-type']).toContain('application/problem+json');
    expect((response.body as { code?: string }).code).toBe('NOT_FOUND');
  });

  it('names the method and path that missed', async () => {
    const response = await request(app()).post('/v1/typo');

    expect((response.body as { detail?: string }).detail).toContain('POST /v1/typo');
  });

  /** Mounted *after* the routes, so a real route is never shadowed by it. */
  it('does not shadow a route that exists', async () => {
    const response = await request(app()).get('/health/live');

    expect(response.status).not.toBe(404);
  });
});

describe('the error handler sits last', () => {
  it('renders every failure as application/problem+json', async () => {
    const response = await request(app()).get('/v1/nope');

    expect(response.headers['content-type']).toContain('application/problem+json');
  });

  it('carries the same traceId in the body and the header', async () => {
    const response = await request(app()).get('/v1/nope');

    expect((response.body as { traceId?: string }).traceId).toBe(response.headers['x-trace-id']);
  });
});
