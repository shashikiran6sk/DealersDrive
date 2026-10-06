import type {
  CustomerSupportTicket,
  CustomerSupportTicketsResponse,
} from '@dealers-drive/contracts';
import type request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { env } from '../src/config/env.js';
import { createAuthHarness, createFakeGoogle, type AuthHarness } from './auth-harness.js';

/**
 * R90 — support requests, from the customer's side.
 *
 * Every property worth pinning is about whose request it is: who can create
 * one, which enquiry it may point at, who can read and answer it, and what
 * the customer is never shown. So the suite signs real customers in through
 * the phone flow and goes through the real guard every time.
 */
let h: AuthHarness;
let counter = 0;
let tokens = 0;

interface Customer {
  agent: request.Agent;
  id: string;
}

let asha: Customer;
let ravi: Customer;
let ashaEnquiry: string;
let raviEnquiry: string;
let listingId: string;

function freeNumber(): string {
  counter += 1;
  return `97377${String(10000 + counter).slice(-5)}`;
}

function devToken(phone: string): string {
  tokens += 1;
  return `dev-otp:91${phone}:${env.PHONE_OTP_DEV_CODE}:support-${String(tokens)}`;
}

async function customer(fullName: string): Promise<Customer> {
  const agent = h.agent();
  const phone = freeNumber();
  const proved = await agent
    .post('/v1/auth/sign-in/phone/customer')
    .send({ phone, accessToken: devToken(phone) })
    .expect(200);
  const created = await agent
    .post('/v1/auth/sign-up/customer')
    .send({ signUpToken: proved.body.signUpToken, fullName })
    .expect(201);
  return { agent, id: created.body.customer.id as string };
}

const VALID = {
  category: 'GENERAL_QUESTION',
  subject: 'How do I compare two cars?',
  description: 'I would like to see two cars side by side before I enquire about either.',
};

function create(who: Customer, body: Record<string, unknown> = VALID) {
  return who.agent.post('/v1/support/tickets').send(body);
}

async function opened(who: Customer, body: Record<string, unknown> = VALID) {
  return (await create(who, body).expect(201)).body as CustomerSupportTicket;
}

function reply(who: Customer, id: string, message: string) {
  return who.agent.post(`/v1/support/tickets/${id}/messages`).send({ message });
}

async function setStatus(id: string, status: 'WAITING_FOR_CUSTOMER' | 'RESOLVED' | 'CLOSED') {
  await h.prisma.supportTicket.update({
    where: { id },
    data: {
      status,
      ...(status === 'RESOLVED' ? { resolvedAt: new Date() } : {}),
      ...(status === 'CLOSED' ? { closedAt: new Date() } : {}),
    },
  });
}

beforeAll(async () => {
  h = await createAuthHarness(createFakeGoogle());
  asha = await customer('Asha Varghese');
  ravi = await customer('Ravi Shankar');

  const stamp = Date.now().toString(36);
  const dealer = await h.prisma.dealer.create({
    data: {
      slug: `support-dealer-${stamp}`,
      brandName: `Support Motors ${stamp}`,
      legalName: `Support Motors ${stamp}`,
      city: 'Katpadi',
      status: 'ACTIVE',
    },
  });
  const vehicle = await h.prisma.vehicle.create({
    data: {
      dealerId: dealer.id,
      registrationNumber: `TN23SP${String(Date.now()).slice(-4)}`,
      rtoCode: 'TN23',
      make: 'Kia',
      model: 'Seltos',
      variant: 'HTX',
      manufacturingYear: 2022,
    },
  });
  const listing = await h.prisma.listing.create({
    data: {
      vehicleId: vehicle.id,
      dealerId: dealer.id,
      status: 'ACTIVE',
      slug: `2022-kia-seltos-${stamp}`,
      publishedAt: new Date(),
    },
  });
  listingId = listing.id;
  ashaEnquiry = (
    await asha.agent.post('/v1/enquiries').send({ listingSlug: listing.slug }).expect(201)
  ).body.id as string;
  raviEnquiry = (
    await ravi.agent.post('/v1/enquiries').send({ listingSlug: listing.slug }).expect(201)
  ).body.id as string;
});

afterAll(async () => {
  await h.close();
});

describe('who may ask', () => {
  it('refuses a visitor with no session, on every route', async () => {
    const anonymous = h.agent();
    const id = '00000000-0000-4000-8000-000000000000';
    await anonymous.get('/v1/support/tickets').expect(401);
    await anonymous.post('/v1/support/tickets').send(VALID).expect(401);
    await anonymous.get(`/v1/support/tickets/${id}`).expect(401);
    await anonymous.post(`/v1/support/tickets/${id}/messages`).send({ message: 'Hi' }).expect(401);
  });

  it('opens a request for a signed-in customer, OPEN, numbered, with nothing internal in it', async () => {
    const res = await create(asha).expect(201);
    expect(res.headers['cache-control']).toBe('no-store');
    const ticket = res.body as CustomerSupportTicket;

    expect(ticket).toMatchObject({
      subject: VALID.subject,
      description: VALID.description,
      category: 'GENERAL_QUESTION',
      categoryLabel: 'General question',
      status: 'OPEN',
      statusLabel: 'Open',
      canReply: true,
      messages: [],
      enquiry: null,
    });
    expect(ticket.reference).toMatch(/^DD-\d{4,}$/);
    for (const hidden of ['priority', 'assignedAdminId', 'customerId', 'notes', 'number']) {
      expect(ticket).not.toHaveProperty(hidden);
    }

    const row = await h.prisma.supportTicket.findUniqueOrThrow({ where: { id: ticket.id } });
    expect(row).toMatchObject({ customerId: asha.id, priority: 'NORMAL', status: 'OPEN' });
    expect(ticket.reference).toBe(`DD-${String(row.number)}`);
    expect(row.number).toBeGreaterThanOrEqual(1001);
  });

  it('gives concurrent requests distinct references', async () => {
    const results = await Promise.all(
      Array.from({ length: 4 }, (_, n) =>
        create(ravi, { ...VALID, subject: `At the same moment ${String(n)}` }).expect(201),
      ),
    );
    const references = results.map((res) => (res.body as CustomerSupportTicket).reference);
    expect(new Set(references).size).toBe(4);
  });

  it('audits the creation without the subject or the description', async () => {
    const ticket = await opened(asha, { ...VALID, subject: 'A private subject line' });
    const trail = await h.prisma.auditLog.findMany({
      where: { entityType: 'SupportTicket', entityId: ticket.id },
    });
    expect(trail.map((row) => [row.action, row.actorType, row.actorId])).toEqual([
      ['support_ticket.created', 'CUSTOMER', asha.id],
    ]);
    expect(JSON.stringify(trail)).not.toContain('A private subject line');
    expect(JSON.stringify(trail)).not.toContain(VALID.description);
  });
});

describe('what a request may carry', () => {
  it.each([
    ['an unknown category', { ...VALID, category: 'COMPLAINT' }, 'category'],
    ['a subject that is too short', { ...VALID, subject: 'Hi' }, 'subject'],
    ['a description that is too short', { ...VALID, description: 'Help me.' }, 'description'],
    ['a description that is too long', { ...VALID, description: 'x'.repeat(5001) }, 'description'],
    ['a priority', { ...VALID, priority: 'URGENT' }, 'priority'],
    ['a status', { ...VALID, status: 'RESOLVED' }, 'status'],
    ['a customer', { ...VALID, customerId: '00000000-0000-4000-8000-000000000000' }, 'customerId'],
    ['a dealer', { ...VALID, dealerId: '00000000-0000-4000-8000-000000000000' }, 'dealerId'],
    ['an enquiry id that is not an id', { ...VALID, enquiryId: 'abc' }, 'enquiryId'],
  ])('refuses %s, naming the field', async (_label, body, field) => {
    const res = await create(asha, body).expect(400);
    expect(JSON.stringify(res.body)).toContain(field);
  });

  it('links one of the customer’s own enquiries, and shows it as their own page does', async () => {
    const ticket = await opened(asha, {
      ...VALID,
      category: 'ENQUIRY_ISSUE',
      enquiryId: ashaEnquiry,
    });
    expect(ticket.enquiry).toMatchObject({
      id: ashaEnquiry,
      vehicleTitle: '2022 Kia Seltos HTX',
      statusLabel: 'Sent',
      vehicleHref: expect.stringMatching(/^\/car\/2022-kia-seltos-/),
    });
    expect(ticket.enquiry?.dealerName).toContain('Support Motors');
    const row = await h.prisma.supportTicket.findUniqueOrThrow({ where: { id: ticket.id } });
    expect(row.enquiryId).toBe(ashaEnquiry);
  });

  it('refuses another customer’s enquiry exactly as one that does not exist', async () => {
    const theirs = await create(asha, { ...VALID, enquiryId: raviEnquiry }).expect(422);
    const missing = await create(asha, {
      ...VALID,
      enquiryId: '00000000-0000-4000-8000-000000000000',
    }).expect(422);
    expect(theirs.body.code).toBe('SUPPORT_ENQUIRY_INVALID');
    expect(missing.body.code).toBe('SUPPORT_ENQUIRY_INVALID');
    expect(theirs.body.detail).toBe(missing.body.detail);
    expect(await h.prisma.supportTicket.count({ where: { enquiryId: raviEnquiry } })).toBe(0);
  });

  it('keeps the request and its enquiry after the car is sold', async () => {
    const ticket = await opened(asha, { ...VALID, enquiryId: ashaEnquiry });
    await h.prisma.listing.update({ where: { id: listingId }, data: { status: 'SOLD' } });
    const res = await asha.agent.get(`/v1/support/tickets/${ticket.id}`).expect(200);
    expect((res.body as CustomerSupportTicket).enquiry).toMatchObject({
      id: ashaEnquiry,
      vehicleTitle: '2022 Kia Seltos HTX',
      vehicleHref: null,
    });
    await h.prisma.listing.update({ where: { id: listingId }, data: { status: 'ACTIVE' } });
  });
});

describe('whose request it is', () => {
  it('lists only the customer’s own, most recently active first', async () => {
    const older = await opened(asha, { ...VALID, subject: 'The older request' });
    const newer = await opened(asha, { ...VALID, subject: 'The newer request' });

    let list = (await asha.agent.get('/v1/support/tickets?limit=50').expect(200))
      .body as CustomerSupportTicketsResponse;
    expect(list.data.map((row) => row.id).indexOf(newer.id)).toBeLessThan(
      list.data.map((row) => row.id).indexOf(older.id),
    );

    await reply(asha, older.id, 'Adding a detail.').expect(201);
    list = (await asha.agent.get('/v1/support/tickets?limit=50').expect(200))
      .body as CustomerSupportTicketsResponse;
    expect(list.data[0]?.id).toBe(older.id);

    const theirs = (await ravi.agent.get('/v1/support/tickets?limit=50').expect(200))
      .body as CustomerSupportTicketsResponse;
    expect(theirs.data.map((row) => row.id)).not.toContain(older.id);
  });

  it('answers 404 to another customer reading or replying, and writes nothing', async () => {
    const ticket = await opened(asha);
    const read = await ravi.agent.get(`/v1/support/tickets/${ticket.id}`).expect(404);
    expect(read.body.code).toBe('SUPPORT_TICKET_NOT_FOUND');
    await reply(ravi, ticket.id, 'Let me in.').expect(404);
    expect(await h.prisma.supportTicketMessage.count({ where: { ticketId: ticket.id } })).toBe(0);
  });

  it('pages by keyset without repeating or skipping', async () => {
    const all = (await asha.agent.get('/v1/support/tickets?limit=50').expect(200))
      .body as CustomerSupportTicketsResponse;
    const seen: string[] = [];
    let cursor: string | null = null;
    do {
      const res = await asha.agent
        .get(`/v1/support/tickets?limit=2${cursor ? `&cursor=${cursor}` : ''}`)
        .expect(200);
      const page = res.body as CustomerSupportTicketsResponse;
      seen.push(...page.data.map((row) => row.id));
      cursor = page.page.nextCursor;
    } while (cursor);
    expect(seen).toEqual(all.data.map((row) => row.id));
  });

  it('refuses an id that is not one, and a cursor it did not issue', async () => {
    await asha.agent.get('/v1/support/tickets/DD-1001').expect(400);
    await asha.agent.get('/v1/support/tickets?cursor=nonsense').expect(409);
  });
});

describe('the conversation', () => {
  it('adds a customer reply, labelled as theirs, and moves nothing on an open request', async () => {
    const ticket = await opened(asha);
    const res = await reply(asha, ticket.id, '  Any update?  ').expect(201);
    const after = res.body as CustomerSupportTicket;
    expect(after.status).toBe('OPEN');
    expect(after.messages).toEqual([
      expect.objectContaining({ author: 'CUSTOMER', authorLabel: 'You', body: 'Any update?' }),
    ]);
    const stored = await h.prisma.supportTicketMessage.findFirstOrThrow({
      where: { ticketId: ticket.id },
    });
    expect(stored).toMatchObject({ authorType: 'CUSTOMER', authorId: asha.id });
  });

  it('shows support’s replies as Dealers-Drive support, never as a person', async () => {
    const ticket = await opened(asha);
    const operator = await h.prisma.user.findFirstOrThrow({ where: { isPlatformAdmin: true } });
    await h.prisma.supportTicketMessage.create({
      data: { ticketId: ticket.id, authorType: 'SUPPORT', authorId: operator.id, body: 'On it.' },
    });
    const res = await asha.agent.get(`/v1/support/tickets/${ticket.id}`).expect(200);
    const body = res.body as CustomerSupportTicket;
    expect(body.messages).toEqual([
      expect.objectContaining({ author: 'SUPPORT', authorLabel: 'Dealers-Drive support' }),
    ]);
    expect(JSON.stringify(body)).not.toContain(operator.id);
    expect(JSON.stringify(body)).not.toContain(operator.email ?? '@');
  });

  it('hands a request waiting on the customer back to support', async () => {
    const ticket = await opened(asha);
    await setStatus(ticket.id, 'WAITING_FOR_CUSTOMER');
    const shown = (await asha.agent.get(`/v1/support/tickets/${ticket.id}`).expect(200))
      .body as CustomerSupportTicket;
    expect(shown.statusLabel).toBe('Awaiting your reply');

    const after = (await reply(asha, ticket.id, 'Here is the detail.').expect(201))
      .body as CustomerSupportTicket;
    expect(after.status).toBe('IN_PROGRESS');
    const trail = await h.prisma.auditLog.findMany({
      where: { entityType: 'SupportTicket', entityId: ticket.id },
      orderBy: { id: 'asc' },
    });
    expect(trail.at(-1)).toMatchObject({
      action: 'support_ticket.status_changed',
      actorType: 'CUSTOMER',
      before: { status: 'WAITING_FOR_CUSTOMER' },
      after: { status: 'IN_PROGRESS', cause: 'customer_reply' },
    });
  });

  it('reopens a resolved request when the customer replies', async () => {
    const ticket = await opened(asha);
    await setStatus(ticket.id, 'RESOLVED');
    const after = (await reply(asha, ticket.id, 'It happened again.').expect(201))
      .body as CustomerSupportTicket;
    expect(after.status).toBe('OPEN');
    const row = await h.prisma.supportTicket.findUniqueOrThrow({ where: { id: ticket.id } });
    expect(row.resolvedAt).toBeNull();
    const trail = await h.prisma.auditLog.findMany({
      where: {
        entityType: 'SupportTicket',
        entityId: ticket.id,
        action: 'support_ticket.reopened',
      },
    });
    expect(trail).toHaveLength(1);
  });

  it('takes no reply on a closed request, and says so', async () => {
    const ticket = await opened(asha);
    await setStatus(ticket.id, 'CLOSED');
    const shown = (await asha.agent.get(`/v1/support/tickets/${ticket.id}`).expect(200))
      .body as CustomerSupportTicket;
    expect(shown.canReply).toBe(false);

    const res = await reply(asha, ticket.id, 'One more thing.').expect(409);
    expect(res.body.code).toBe('SUPPORT_TICKET_CLOSED');
    expect(await h.prisma.supportTicketMessage.count({ where: { ticketId: ticket.id } })).toBe(0);
    expect(
      (await h.prisma.supportTicket.findUniqueOrThrow({ where: { id: ticket.id } })).status,
    ).toBe('CLOSED');
  });

  it('refuses an empty reply, an oversized one, and a reply posing as support', async () => {
    const ticket = await opened(asha);
    await reply(asha, ticket.id, '   ').expect(400);
    await reply(asha, ticket.id, 'x'.repeat(5001)).expect(400);
    const posing = await asha.agent
      .post(`/v1/support/tickets/${ticket.id}/messages`)
      .send({ message: 'Resolved by support', authorType: 'SUPPORT' })
      .expect(400);
    expect(JSON.stringify(posing.body)).toContain('authorType');
  });
});
