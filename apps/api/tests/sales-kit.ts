import type request from 'supertest';

import type { AuthHarness } from './auth-harness.js';

/**
 * Step 1 of assisted onboarding, the email half: the representative asks for a
 * code, the dealer reads it from their inbox, and the code is exchanged for a
 * single-use ticket. Here the inbox is the harness's recording mailer.
 */
export function lastEmailCode(h: AuthHarness, email: string): string {
  const message = [...h.mailer.sent].reverse().find((sent) => sent.to === email);
  const code = /\b(\d{6})\b/.exec(message?.text ?? '')?.[1];
  if (!code) throw new Error(`no verification code was emailed to ${email}`);
  return code;
}

export function requestEmailCode(agent: request.Agent, email: string): request.Test {
  return agent.post('/v1/sales/dealers/email/code').send({ email });
}

export async function proveEmail(h: AuthHarness, agent: request.Agent, email: string) {
  const sent = await requestEmailCode(agent, email).expect(200);
  const verified = await agent
    .post('/v1/sales/dealers/email/verify')
    .send({ challenge: sent.body.challenge, code: lastEmailCode(h, email) })
    .expect(200);
  return {
    email: verified.body.email as string,
    challenge: sent.body.challenge as string,
    emailTicket: verified.body.emailTicket as string,
  };
}
