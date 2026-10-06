import express, { type Express } from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { getContext, requestContext } from '../../../src/middleware/request-context.js';
import {
  CLIENT_IP_HEADER,
  CLIENT_IP_SECRET_HEADER,
  createTrustedClientIp,
} from '../../../src/middleware/trusted-client-ip.js';

/**
 * R107 — the web tier calls the API from its own servers, so every request
 * arrives from the web tier's address and every per-IP limiter would count the
 * whole internet as one visitor. The web forwards the visitor's address, and
 * the API believes it only when the request also carries the shared secret.
 * Anyone on the internet can send `x-dd-client-ip`; only the web tier knows
 * the secret.
 */

const SECRET = 'a-shared-secret-of-at-least-thirty-two-chars';
const PROXY_ADDRESS = '198.51.100.7';

function app(secret: string | undefined): Express {
  const server = express();
  server.set('trust proxy', 1);
  server.use(createTrustedClientIp(secret));
  server.use(requestContext);
  server.get('/whoami', (req, res) => {
    res.json({
      ip: req.ip,
      contextIp: getContext()?.ip,
      sawSecret: req.headers[CLIENT_IP_SECRET_HEADER] !== undefined,
      sawClaim: req.headers[CLIENT_IP_HEADER] !== undefined,
    });
  });
  return server;
}

function from(server: Express) {
  return request(server).get('/whoami').set('X-Forwarded-For', PROXY_ADDRESS);
}

describe('createTrustedClientIp', () => {
  it('uses the forwarded address when the secret matches', async () => {
    const response = await from(app(SECRET))
      .set(CLIENT_IP_HEADER, '203.0.113.42')
      .set(CLIENT_IP_SECRET_HEADER, SECRET);

    expect(response.body).toMatchObject({ ip: '203.0.113.42', contextIp: '203.0.113.42' });
  });

  it('accepts an IPv6 address', async () => {
    const response = await from(app(SECRET))
      .set(CLIENT_IP_HEADER, '2001:db8::1')
      .set(CLIENT_IP_SECRET_HEADER, SECRET);

    expect(response.body.ip).toBe('2001:db8::1');
  });

  it('ignores the claim when the secret is wrong', async () => {
    const response = await from(app(SECRET))
      .set(CLIENT_IP_HEADER, '203.0.113.42')
      .set(CLIENT_IP_SECRET_HEADER, `${SECRET}-but-wrong`);

    expect(response.body).toMatchObject({ ip: PROXY_ADDRESS, contextIp: PROXY_ADDRESS });
  });

  it('ignores the claim when no secret is presented', async () => {
    const response = await from(app(SECRET)).set(CLIENT_IP_HEADER, '203.0.113.42');

    expect(response.body.ip).toBe(PROXY_ADDRESS);
  });

  it('ignores a claim that is not an IP address', async () => {
    const response = await from(app(SECRET))
      .set(CLIENT_IP_HEADER, '203.0.113.42, 10.0.0.1')
      .set(CLIENT_IP_SECRET_HEADER, SECRET);

    expect(response.body.ip).toBe(PROXY_ADDRESS);
  });

  it('believes nobody when the API has no secret configured', async () => {
    const response = await from(app(undefined))
      .set(CLIENT_IP_HEADER, '203.0.113.42')
      .set(CLIENT_IP_SECRET_HEADER, SECRET);

    expect(response.body.ip).toBe(PROXY_ADDRESS);
  });

  it('removes both headers so nothing downstream can log the secret', async () => {
    const response = await from(app(SECRET))
      .set(CLIENT_IP_HEADER, '203.0.113.42')
      .set(CLIENT_IP_SECRET_HEADER, SECRET);

    expect(response.body).toMatchObject({ sawSecret: false, sawClaim: false });
  });

  it('keeps per-IP limits per visitor: two visitors behind the web tier are two keys', async () => {
    const server = app(SECRET);
    const first = await from(server)
      .set(CLIENT_IP_HEADER, '203.0.113.1')
      .set(CLIENT_IP_SECRET_HEADER, SECRET);
    const second = await from(server)
      .set(CLIENT_IP_HEADER, '203.0.113.2')
      .set(CLIENT_IP_SECRET_HEADER, SECRET);

    expect(first.body.ip).not.toBe(second.body.ip);
  });
});
