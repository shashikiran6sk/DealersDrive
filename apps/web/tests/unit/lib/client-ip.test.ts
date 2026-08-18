import { describe, expect, it } from 'vitest';

import { clientIpHeaders } from '../../../src/lib/client-ip.js';
import { requestHeaders } from '../../setup.js';

/**
 * §14.1 / A7 / A15. Every public mutation — an enquiry, a phone reveal — is
 * proxied through a Server Action, so the API sees a request from the *Next
 * server* rather than from the buyer. Without this function the per-IP rate
 * limits that stop a competitor harvesting dealer phone numbers would be a
 * single shared bucket for the whole internet.
 *
 * The chain is **rebuilt from the leftmost address, not extended**. The API
 * runs `trust proxy: 1` and therefore reads the last hop; appending our value
 * would leave a caller-supplied header in front of it, and a competitor could
 * then rotate their apparent address on every request by sending their own
 * `x-forwarded-for` first. That is the whole reason this does not just pass
 * the header through.
 */

describe('clientIpHeaders', () => {
  it('forwards the buyer’s address from x-forwarded-for', async () => {
    requestHeaders.set('x-forwarded-for', '203.0.113.7');

    expect(await clientIpHeaders()).toEqual({
      'x-forwarded-for': '203.0.113.7',
      'x-real-ip': '203.0.113.7',
    });
  });

  /**
   * The leftmost entry is the original client; everything after it is a proxy
   * this request already passed through.
   */
  it('takes the leftmost address from a proxy chain', async () => {
    requestHeaders.set('x-forwarded-for', '203.0.113.7, 70.41.3.18, 150.172.238.178');

    expect((await clientIpHeaders())['x-forwarded-for']).toBe('203.0.113.7');
  });

  /**
   * The security property. A caller sending their own chain gets one address
   * out the other side — the leftmost — rather than being able to append a
   * fresh one per request and reset their own rate-limit bucket.
   */
  it('rebuilds the chain rather than extending it, so a caller cannot rotate addresses', async () => {
    requestHeaders.set('x-forwarded-for', '198.51.100.9, 203.0.113.7');

    const forwarded = await clientIpHeaders();

    expect(forwarded['x-forwarded-for']).toBe('198.51.100.9');
    expect(forwarded['x-forwarded-for']).not.toContain(',');
  });

  it('trims the whitespace a chain carries', async () => {
    requestHeaders.set('x-forwarded-for', '  203.0.113.7  , 70.41.3.18');

    expect((await clientIpHeaders())['x-forwarded-for']).toBe('203.0.113.7');
  });

  it('falls back to x-real-ip when there is no forwarded chain', async () => {
    requestHeaders.set('x-real-ip', '203.0.113.7');

    expect(await clientIpHeaders()).toEqual({
      'x-forwarded-for': '203.0.113.7',
      'x-real-ip': '203.0.113.7',
    });
  });

  it('falls back to x-real-ip when the chain is empty', async () => {
    requestHeaders.set('x-forwarded-for', '');
    requestHeaders.set('x-real-ip', '203.0.113.7');

    expect((await clientIpHeaders())['x-real-ip']).toBe('203.0.113.7');
  });

  it('falls back when the leftmost entry is only whitespace', async () => {
    requestHeaders.set('x-forwarded-for', '   , 70.41.3.18');
    requestHeaders.set('x-real-ip', '203.0.113.7');

    expect((await clientIpHeaders())['x-forwarded-for']).toBe('203.0.113.7');
  });

  /**
   * Sending an empty header would be worse than sending none: the API's
   * `trust proxy` handling would read it and resolve to nothing, where an
   * absent header lets it fall back to the socket address.
   */
  it('sends no header at all when there is no address to forward', async () => {
    expect(await clientIpHeaders()).toEqual({});
  });

  it('prefers the forwarded chain over x-real-ip when both are present', async () => {
    requestHeaders.set('x-forwarded-for', '203.0.113.7');
    requestHeaders.set('x-real-ip', '198.51.100.9');

    expect((await clientIpHeaders())['x-forwarded-for']).toBe('203.0.113.7');
  });

  it('sets both headers to the same address, so neither can disagree', async () => {
    requestHeaders.set('x-forwarded-for', '203.0.113.7, 70.41.3.18');

    const forwarded = await clientIpHeaders();

    expect(forwarded['x-forwarded-for']).toBe(forwarded['x-real-ip']);
  });
});
