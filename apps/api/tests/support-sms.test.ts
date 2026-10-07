import type { AdminNotificationsResponse, CustomerSupportTicket } from '@dealers-drive/contracts';
import type request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { env } from '../src/config/env.js';
import { createAuthHarness, createFakeGoogle, type AuthHarness } from './auth-harness.js';
import { marketplaceFixtures } from './marketplace-fixtures.js';

/**
 * R118 — a support request is acknowledged by SMS to the customer's proved
 * number, through the same outbox, idempotency claim and delivery log as every
 * email. The harness records instead of sending: nothing here reaches MSG91.
 */
let h: AuthHarness;
let admin: request.Agent;
let counter = 0;
const RUN = Date.now().toString(36);

interface Customer {
  agent: request.Agent;
  phone: string;
}

async function customer(fullName: string): Promise<Customer> {
  counter += 1;
  const agent = h.agent();
  const digits = `95399${String(10000 + counter).slice(-5)}`;
  const proved = await agent
    .post('/v1/auth/sign-in/phone/customer')
    .send({
      phone: digits,
      accessToken: `dev-otp:91${digits}:${env.PHONE_OTP_DEV_CODE}:r118-${RUN}-${String(counter)}`,
    })
    .expect(200);
  await agent
    .post('/v1/auth/sign-up/customer')
    .send({ signUpToken: proved.body.signUpToken, fullName })
    .expect(201);
  return { agent, phone: `+91${digits}` };
}

async function raise(who: Customer): Promise<CustomerSupportTicket> {
  const res = await who.agent
    .post('/v1/support/tickets')
    .send({
      category: 'ACCOUNT_ISSUE',
      subject: `Cannot change my name ${RUN}`,
      description: 'The profile page will not save my new surname whatever I try.',
    })
    .expect(201);
  return res.body as CustomerSupportTicket;
}

beforeAll(async () => {
  h = await createAuthHarness(createFakeGoogle());
  admin = await marketplaceFixtures(h, 'r118-sms').moderator();
});

afterAll(async () => {
  await h.close();
});

describe('a new support request', () => {
  it('is acknowledged by SMS to the proved number, with the reference and nothing else', async () => {
    const ravi = await customer('Ravi Kumar');
    const before = h.sms.sent.length;
    const ticket = await raise(ravi);
    await h.drainEmails();
    await h.drainEmails();

    const texts = h.sms.sent.slice(before).filter((message) => message.to === ravi.phone);
    expect(texts).toHaveLength(1);
    expect(texts[0]).toMatchObject({
      tag: 'sms.support.ticket-ack',
      variables: { reference: ticket.reference },
    });
    expect(JSON.stringify(texts[0])).not.toContain('surname');

    const rows = await h.prisma.notificationDelivery.findMany({
      where: { channel: 'SMS', recipient: ravi.phone },
      select: { template: true, subject: true, status: true, dealerId: true },
    });
    expect(rows).toEqual([
      {
        template: 'sms.support.ticket-ack',
        subject: `Support request ${ticket.reference} received`,
        status: 'SENT',
        dealerId: null,
      },
    ]);
  });

  it('shows in the Super-admin delivery log as an SMS', async () => {
    const asha = await customer('Asha Menon');
    await raise(asha);
    await h.drainEmails();

    const log = (
      await admin
        .get('/v1/admin/notifications')
        .query({ q: asha.phone.slice(-10) })
        .expect(200)
    ).body as AdminNotificationsResponse;
    expect(log.data.map((row) => [row.channel, row.template])).toEqual([
      ['SMS', 'sms.support.ticket-ack'],
    ]);
  });

  it('does not text the customer again when support replies or moves the request', async () => {
    const neha = await customer('Neha Kapoor');
    const ticket = await raise(neha);
    await h.drainEmails();
    const before = h.sms.sent.length;

    await admin
      .patch(`/v1/admin/support/tickets/${ticket.id}`)
      .send({ status: 'IN_PROGRESS' })
      .expect(200);
    await h.drainEmails();

    expect(h.sms.sent.slice(before).filter((message) => message.to === neha.phone)).toEqual([]);
  });
});
