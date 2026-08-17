import 'server-only';

import { headers } from 'next/headers';

/**
 * The buyer's address, as headers for an outgoing API call.
 *
 * Every public mutation (enquiry, phone reveal) is proxied through a Server
 * Action, so without this the API would see the Next server for every request
 * and the per-IP limits that stop competitors harvesting dealer phone numbers
 * would be a single shared bucket (ARCHITECTURE §14.1, API-SPEC A7/A15).
 *
 * The API runs `trust proxy: 1`, so it reads the *last* hop — appending our
 * value would let a caller spoof theirs by sending their own header first, and
 * so the chain is rebuilt from the leftmost address we were given rather than
 * extended.
 */
export async function clientIpHeaders(): Promise<Record<string, string>> {
  const incoming = await headers();

  const forwarded = incoming.get('x-forwarded-for');
  const first = forwarded?.split(',')[0]?.trim();
  const ip = first && first.length > 0 ? first : incoming.get('x-real-ip');

  if (!ip) return {};
  return { 'x-forwarded-for': ip, 'x-real-ip': ip };
}
