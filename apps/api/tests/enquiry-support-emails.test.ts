import type { CustomerSupportTicket } from '@dealers-drive/contracts';
import type request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { env } from '../src/config/env.js';
import { createAuthHarness, createFakeGoogle, type AuthHarness } from './auth-harness.js';
import { marketplaceFixtures, type Dealership } from './marketplace-fixtures.js';

/**
 * R117 — an enquiry told to the dealership, and a support request told to the
 * support desk and to the customer who raised it, as it is received and as its
 * status moves. Customer mail goes only to a verified address.
 */
let h: AuthHarness;
let admin: request.Agent;
let dealership: Dealership;
let ownerEmail: string;
let supportEmail: string;
let salesEmail: string;
let slug: string;
let counter = 0;
const OPS = env.adminAllowlist[0] ?? '';
const RUN = Date.now().toString(36);

interface Customer {
  agent: request.Agent;
  id: string;
  phone: string;
  email: string | null;
}

let asha: Customer;
let ravi: Customer;

async function customer(fullName: string, verified: boolean): Promise<Customer> {
  counter += 1;
  const agent = h.agent();
  const phone = `95388${String(10000 + counter).slice(-5)}`;
  const proved = await agent
    .post('/v1/auth/sign-in/phone/customer')
    .send({
      phone,
      accessToken: `dev-otp:91${phone}:${env.PHONE_OTP_DEV_CODE}:r117-${RUN}-${String(counter)}`,
    })
    .expect(200);
  const created = await agent
    .post('/v1/auth/sign-up/customer')
    .send({ signUpToken: proved.body.signUpToken, fullName })
    .expect(201);
  const id = created.body.customer.id as string;
  const email = verified ? `r117-${RUN}-${String(counter)}@customers.test` : null;
  if (email) {
    await h.prisma.user.update({ where: { id }, data: { email, emailVerifiedAt: new Date() } });
  }
  return { agent, id, phone, email };
}

async function staff(role: 'SUPPORT' | 'SALES_REP', label: string): Promise<string> {
  const email = `r117-${label}-${RUN}@dealers-drive.test`;
  await admin.post('/v1/admin/members').send({ email, role }).expect(201);
  counter += 1;
  h.google.claims = { subject: `r117-${label}-${RUN}`, email, emailVerified: true };
  await h.signInAdmin(h.agent());
  return email;
}

function sentSince(before: number) {
  return h.mailer.sent.slice(before).map((message) => ({
    to: message.to,
    tag: message.tag,
    subject: message.subject,
    text: message.text,
    html: message.html,
  }));
}

function about(before: number, reference: string) {
  const exact = new RegExp(`${reference}\\b`);
  return sentSince(before).filter((message) => exact.test(message.text));
}

async function raise(who: Customer, subject: string): Promise<CustomerSupportTicket> {
  const res = await who.agent
    .post('/v1/support/tickets')
    .send({
      category: 'DEALER_ISSUE',
      subject,
      description: 'My private account details are 4111-1111 and nobody has called me back.',
    })
    .expect(201);
  return res.body as CustomerSupportTicket;
}

beforeAll(async () => {
  h = await createAuthHarness(createFakeGoogle());
  const fixtures = marketplaceFixtures(h, 'r117-mail');
  dealership = await fixtures.dealership();
  admin = await fixtures.moderator();
  const owner = await h.prisma.dealerMember.findFirstOrThrow({
    where: { dealerId: dealership.dealerId, role: 'OWNER' },
    include: { user: true },
  });
  ownerEmail = owner.user.email ?? '';

  supportEmail = await staff('SUPPORT', 'support');
  salesEmail = await staff('SALES_REP', 'sales');

  const vehicle = await h.prisma.vehicle.create({
    data: {
      dealerId: dealership.dealerId,
      registrationNumber: `TN38EM${String(Date.now()).slice(-4)}`,
      rtoCode: 'TN38',
      make: 'Tata',
      model: 'Nexon',
      variant: 'XZ+',
      manufacturingYear: 2022,
    },
  });
  slug = `2022-tata-nexon-${RUN}`;
  await h.prisma.listing.create({
    data: {
      vehicleId: vehicle.id,
      dealerId: dealership.dealerId,
      status: 'ACTIVE',
      slug,
      publishedAt: new Date(),
    },
  });

  asha = await customer('Asha Menon', true);
  ravi = await customer('Ravi Kumar', false);
});

afterAll(async () => {
  await h.close();
});

describe('an enquiry', () => {
  it('tells the dealership who asked about which car — without the buyer’s number', async () => {
    await h.drainEmails();
    const before = h.mailer.sent.length;
    await asha.agent
      .post('/v1/enquiries')
      .send({ listingSlug: slug, message: 'Is the price negotiable? <b>Asap</b>' })
      .expect(201);
    await h.drainEmails();

    const toDealer = sentSince(before).filter((message) => message.to === ownerEmail);
    expect(toDealer).toHaveLength(1);
    const [mail] = toDealer;
    expect(mail?.tag).toBe('dealer.enquiry.received');
    expect(mail?.subject).toContain('Tata Nexon');
    expect(mail?.text).toContain('Asha has enquired');
    expect(mail?.text).toContain('Is the price negotiable?');
    expect(mail?.text).toContain('/dealer/enquiries');
    expect(mail?.html).toContain('&lt;b&gt;Asap&lt;/b&gt;');
    expect(mail?.text).not.toContain(asha.phone);
    expect(mail?.text).not.toContain('Menon');
    expect(sentSince(before).some((message) => message.to === asha.email)).toBe(false);
  });

  it('asks for a call back when the buyer left no message', async () => {
    const before = h.mailer.sent.length;
    await ravi.agent.post('/v1/enquiries').send({ listingSlug: slug }).expect(201);
    await h.drainEmails();

    const mail = sentSince(before).find((message) => message.to === ownerEmail);
    expect(mail?.text).toContain('Ravi has enquired');
    expect(mail?.text).toContain('call them back');
  });
});

describe('a support request', () => {
  it('reaches the support desk and the customer, and never the Sales team', async () => {
    const before = h.mailer.sent.length;
    const ticket = await raise(asha, `Dealer did not call back ${RUN}-a`);
    await h.drainEmails();

    const mail = about(before, ticket.reference);
    const desk = mail.filter((message) => message.tag === 'admin.support.ticket-created');
    expect(desk.map((message) => message.to)).toEqual(expect.arrayContaining([OPS, supportEmail]));
    expect(desk.some((message) => message.to === salesEmail)).toBe(false);
    expect(desk[0]?.text).toContain(`/admin/support/${ticket.id}`);
    expect(desk[0]?.text).toContain('Problem with a dealer');

    const toCustomer = mail.filter((message) => message.to === asha.email);
    expect(toCustomer.map((message) => message.tag)).toEqual(['customer.support.ticket-received']);
    expect(toCustomer[0]?.subject).toContain(ticket.reference);
    expect(toCustomer[0]?.text).toContain(`/support-requests/${ticket.id}`);

    for (const message of mail) expect(message.text).not.toContain('4111-1111');
  });

  it('emails a customer only at a verified address', async () => {
    const before = h.mailer.sent.length;
    const ticket = await raise(ravi, `No verified email ${RUN}-b`);
    await h.drainEmails();

    const mail = about(before, ticket.reference);
    expect(mail.every((message) => message.tag === 'admin.support.ticket-created')).toBe(true);
    expect(mail.length).toBeGreaterThan(0);
  });

  it('tells the customer when support moves it, and not when nothing they see changes', async () => {
    const ticket = await raise(asha, `Status moves ${RUN}-c`);
    await h.drainEmails();

    let before = h.mailer.sent.length;
    await admin
      .patch(`/v1/admin/support/tickets/${ticket.id}`)
      .send({ status: 'WAITING_FOR_CUSTOMER' })
      .expect(200);
    await h.drainEmails();
    let mail = about(before, ticket.reference).filter((message) => message.to === asha.email);
    expect(mail.map((message) => message.tag)).toEqual(['customer.support.ticket-status']);
    expect(mail[0]?.subject).toContain('Awaiting your reply');

    before = h.mailer.sent.length;
    await admin
      .patch(`/v1/admin/support/tickets/${ticket.id}`)
      .send({ priority: 'HIGH' })
      .expect(200);
    await asha.agent
      .post(`/v1/support/tickets/${ticket.id}/messages`)
      .send({ message: 'Here are the details you asked for.' })
      .expect(201);
    await h.drainEmails();
    expect(about(before, ticket.reference)).toEqual([]);

    before = h.mailer.sent.length;
    await admin
      .patch(`/v1/admin/support/tickets/${ticket.id}`)
      .send({ status: 'RESOLVED' })
      .expect(200);
    await h.drainEmails();
    mail = about(before, ticket.reference).filter((message) => message.to === asha.email);
    expect(mail.map((message) => message.subject)).toEqual([
      `${ticket.reference}: Resolved — Dealers-Drive`,
    ]);
    expect(mail[0]?.text).toContain('reply in the request and it will reopen');
  });

  it('sends each status email once however often the outbox is drained', async () => {
    const ticket = await raise(asha, `Exactly once ${RUN}-d`);
    await admin
      .patch(`/v1/admin/support/tickets/${ticket.id}`)
      .send({ status: 'IN_PROGRESS' })
      .expect(200);
    await h.drainEmails();
    await h.drainEmails();

    const rows = await h.prisma.notificationDelivery.findMany({
      where: { template: 'customer.support.ticket-status', recipient: asha.email ?? '' },
      select: { subject: true, status: true, dealerId: true },
    });
    const mine = rows.filter((row) => row.subject.startsWith(ticket.reference));
    expect(mine).toEqual([
      {
        subject: `${ticket.reference}: In progress — Dealers-Drive`,
        status: 'SENT',
        dealerId: null,
      },
    ]);
  });
});
