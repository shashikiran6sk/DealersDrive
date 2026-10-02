import type {
  AdminEnquiryDetail,
  AdminSupportTicketDetail,
  AdminSupportTicketsResponse,
  CustomerSupportTicket,
} from '@dealers-drive/contracts';
import type request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { env } from '../src/config/env.js';
import { createAuthHarness, createFakeGoogle, type AuthHarness } from './auth-harness.js';
import { marketplaceFixtures, type Dealership } from './marketplace-fixtures.js';

/**
 * R91 — the admin's support ticket workspace.
 *
 * Real customers raise real tickets through the customer routes; real admins
 * answer them through the console's. The properties pinned are the ones a
 * support desk is trusted with: who may work a ticket, that a reply reaches the
 * customer and an internal note never does, that status moves only as the
 * table allows, and that the ticket leads to the enquiry, dealer and car
 * without copying them.
 */
let h: AuthHarness;
let admin: request.Agent;
let colleagueId: string;
let colleagueLabel: string;
let adminId: string;
let dealership: Dealership;
let counter = 0;
let tokens = 0;

interface Customer {
  agent: request.Agent;
  id: string;
}

let neha: Customer;
let vikram: Customer;
let enquiryId: string;
let listingId: string;

function freeNumber(): string {
  counter += 1;
  return `95377${String(10000 + counter).slice(-5)}`;
}

async function customer(fullName: string): Promise<Customer> {
  const agent = h.agent();
  const phone = freeNumber();
  tokens += 1;
  const proved = await agent
    .post('/v1/auth/sign-in/phone/customer')
    .send({
      phone,
      accessToken: `dev-otp:91${phone}:${env.PHONE_OTP_DEV_CODE}:admin-support-${String(tokens)}`,
    })
    .expect(200);
  const created = await agent
    .post('/v1/auth/sign-up/customer')
    .send({ signUpToken: proved.body.signUpToken, fullName })
    .expect(201);
  return { agent, id: created.body.customer.id as string };
}

async function raise(
  who: Customer,
  extra: Record<string, unknown> = {},
): Promise<CustomerSupportTicket> {
  const res = await who.agent
    .post('/v1/support/tickets')
    .send({
      category: 'ENQUIRY_ISSUE',
      subject: 'The dealer has not called me back',
      description: 'I enquired three days ago and nobody has contacted me about the car yet.',
      ...extra,
    })
    .expect(201);
  return res.body as CustomerSupportTicket;
}

function patch(agent: request.Agent, id: string, body: Record<string, unknown>) {
  return agent.patch(`/v1/admin/support/tickets/${id}`).send(body);
}

async function workspace(id: string): Promise<AdminSupportTicketDetail> {
  return (await admin.get(`/v1/admin/support/tickets/${id}`).expect(200))
    .body as AdminSupportTicketDetail;
}

async function queue(query = ''): Promise<AdminSupportTicketsResponse> {
  return (await admin.get(`/v1/admin/support/tickets${query}`).expect(200))
    .body as AdminSupportTicketsResponse;
}

beforeAll(async () => {
  h = await createAuthHarness(createFakeGoogle());
  const fixtures = marketplaceFixtures(h, 'support-desk');
  dealership = await fixtures.dealership();
  admin = await fixtures.moderator();

  adminId = (
    await h.prisma.user.findFirstOrThrow({ where: { email: env.adminAllowlist[0] ?? '' } })
  ).id;
  colleagueLabel = 'Second Operator';
  colleagueId = (
    await h.prisma.user.create({
      data: {
        email: `support-desk-colleague-${Date.now().toString(36)}@dealers-drive.test`,
        fullName: colleagueLabel,
        isPlatformAdmin: true,
        adminRole: 'SUPPORT',
        roles: { create: { role: 'ADMIN', status: 'ACTIVE', grantedBy: adminId } },
      },
    })
  ).id;

  const vehicle = await h.prisma.vehicle.create({
    data: {
      dealerId: dealership.dealerId,
      registrationNumber: `TN38SD${String(Date.now()).slice(-4)}`,
      rtoCode: 'TN38',
      make: 'Mahindra',
      model: 'XUV700',
      variant: 'AX7',
      manufacturingYear: 2023,
    },
  });
  const listing = await h.prisma.listing.create({
    data: {
      vehicleId: vehicle.id,
      dealerId: dealership.dealerId,
      status: 'ACTIVE',
      slug: `2023-mahindra-xuv700-${Date.now().toString(36)}`,
      publishedAt: new Date(),
    },
  });
  listingId = listing.id;

  neha = await customer('Neha Kapoor');
  vikram = await customer('Vikram Singh');
  enquiryId = (
    await neha.agent.post('/v1/enquiries').send({ listingSlug: listing.slug }).expect(201)
  ).body.id as string;
});

afterAll(async () => {
  await h.close();
});

describe('who may work a ticket', () => {
  it('refuses no session, a customer and a dealer, on every route', async () => {
    const ticket = await raise(neha);
    const id = ticket.id;
    for (const agent of [h.agent(), neha.agent, dealership.agent]) {
      await agent.get('/v1/admin/support/tickets').expect(401);
      await agent.get(`/v1/admin/support/tickets/${id}`).expect(401);
      await agent.patch(`/v1/admin/support/tickets/${id}`).send({ priority: 'URGENT' }).expect(401);
      await agent
        .post(`/v1/admin/support/tickets/${id}/messages`)
        .send({ message: 'x' })
        .expect(401);
      await agent.post(`/v1/admin/support/tickets/${id}/notes`).send({ note: 'x' }).expect(401);
    }
    const row = await h.prisma.supportTicket.findUniqueOrThrow({ where: { id } });
    expect(row.priority).toBe('NORMAL');
    expect(await h.prisma.supportTicketNote.count({ where: { ticketId: id } })).toBe(0);
  });

  it('does not show support tickets to the dealership the enquiry was sent to', async () => {
    await raise(neha, { enquiryId });
    await dealership.agent.get('/v1/support/tickets').expect(200);
    const inbox = await dealership.agent.get('/v1/dealer/enquiries').expect(200);
    expect(JSON.stringify(inbox.body)).not.toContain('The dealer has not called me back');
  });
});

describe('the queue', () => {
  it('lists every customer’s tickets, newest activity first, with who and what they are about', async () => {
    const linked = await raise(neha, { enquiryId });
    const other = await raise(vikram, {
      category: 'ACCOUNT_ISSUE',
      subject: 'Change my name please',
    });

    const res = await admin.get('/v1/admin/support/tickets').expect(200);
    expect(res.headers['cache-control']).toBe('no-store');
    const page = res.body as AdminSupportTicketsResponse;
    const ids = page.data.map((row) => row.id);
    expect(ids.indexOf(other.id)).toBeLessThan(ids.indexOf(linked.id));

    expect(page.data.find((row) => row.id === linked.id)).toMatchObject({
      reference: linked.reference,
      status: 'OPEN',
      priority: 'NORMAL',
      priorityLabel: 'Normal',
      customer: { id: neha.id, name: 'Neha Kapoor', phoneDisplay: expect.stringMatching(/^\+91 /) },
      context: {
        enquiryId,
        vehicleTitle: '2023 Mahindra XUV700 AX7',
        dealerName: expect.stringContaining('support-desk'),
      },
      assignee: null,
    });
    expect(page.data.find((row) => row.id === other.id)?.context).toBeNull();
    expect(page.assignees.map((person) => person.id)).toEqual(
      expect.arrayContaining([adminId, colleagueId]),
    );
  });

  it.each([
    ['the reference', (t: CustomerSupportTicket) => t.reference.toLowerCase()],
    ['the bare number', (t: CustomerSupportTicket) => t.reference.slice(3)],
    ['the customer’s name', () => 'vikram'],
    ['the subject', () => 'change my name'],
  ])('finds a ticket by %s', async (_label, term) => {
    const ticket = await raise(vikram, {
      category: 'ACCOUNT_ISSUE',
      subject: 'Change my name please',
    });
    const page = await queue(`?q=${encodeURIComponent(term(ticket))}&limit=100`);
    expect(page.data.map((row) => row.id)).toContain(ticket.id);
  });

  it('finds tickets by the car or the dealership of the enquiry they are about', async () => {
    const linked = await raise(neha, { enquiryId });
    expect((await queue('?q=xuv700&limit=100')).data.map((row) => row.id)).toContain(linked.id);
    expect((await queue('?q=support-desk&limit=100')).data.map((row) => row.id)).toContain(
      linked.id,
    );
  });

  it('filters by status, category, priority, assignee and day, counting under the other filters', async () => {
    const ticket = await raise(vikram, {
      category: 'TECHNICAL_ISSUE',
      subject: 'Page will not load',
    });
    await patch(admin, ticket.id, {
      priority: 'URGENT',
      assignedAdminId: colleagueId,
      status: 'IN_PROGRESS',
    }).expect(200);

    const filtered = await queue(
      `?category=TECHNICAL_ISSUE&priority=URGENT&assignee=${colleagueId}&status=IN_PROGRESS`,
    );
    expect(filtered.data.map((row) => row.id)).toEqual([ticket.id]);
    expect(filtered.counts.IN_PROGRESS).toBe(1);
    expect(filtered.counts.ALL).toBe(1);

    expect((await queue('?assignee=me&limit=100')).data.map((row) => row.id)).not.toContain(
      ticket.id,
    );
    expect((await queue('?assignee=unassigned&limit=100')).data.map((row) => row.id)).not.toContain(
      ticket.id,
    );

    const today = new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10);
    expect(
      (await queue(`?from=${today}&to=${today}&limit=100`)).data.map((row) => row.id),
    ).toContain(ticket.id);
    expect((await queue('?to=2020-01-01')).data).toEqual([]);
  });

  it('pages by keyset, and refuses what it does not know', async () => {
    const all = (await queue('?limit=100')).data.map((row) => row.id);
    const seen: string[] = [];
    let cursor: string | null = null;
    do {
      const page: AdminSupportTicketsResponse = await queue(
        `?limit=3${cursor ? `&cursor=${cursor}` : ''}`,
      );
      seen.push(...page.data.map((row) => row.id));
      cursor = page.page.nextCursor;
    } while (cursor);
    expect(seen).toEqual(all);

    await admin.get('/v1/admin/support/tickets?status=PENDING').expect(400);
    await admin.get('/v1/admin/support/tickets?assignee=someone').expect(400);
    await admin.get('/v1/admin/support/tickets?customerId=x').expect(400);
  });
});

describe('the workspace', () => {
  it('shows the customer, the enquiry, the dealer and the car, read through the one reference', async () => {
    const ticket = await raise(neha, { enquiryId });
    const detail = await workspace(ticket.id);

    expect(detail).toMatchObject({
      description: 'I enquired three days ago and nobody has contacted me about the car yet.',
      canReply: true,
      transitions: ['IN_PROGRESS', 'WAITING_FOR_CUSTOMER', 'RESOLVED', 'CLOSED'],
      customer: { id: neha.id, name: 'Neha Kapoor', phone: expect.stringMatching(/^\+91/) },
      enquiry: {
        id: enquiryId,
        statusLabel: 'New',
        customerStatusLabel: 'Sent',
        adminHref: `/admin/enquiries/${enquiryId}`,
      },
      vehicle: {
        listingId,
        title: '2023 Mahindra XUV700 AX7',
        listingStatus: 'ACTIVE',
        adminHref: `/admin/listings/${listingId}`,
        publicHref: expect.stringMatching(/^\/car\//),
        image: null,
      },
      dealer: { id: dealership.dealerId, adminHref: `/admin/dealers/${dealership.dealerId}` },
      messages: [],
      notes: [],
    });
    expect(detail.customer.ticketCount).toBeGreaterThan(1);
    expect(detail.history.map((entry) => [entry.label, entry.actor])).toEqual([
      ['Request created', 'Customer'],
    ]);
  });

  it('keeps the context when the car is withdrawn, with no public link', async () => {
    const ticket = await raise(neha, { enquiryId });
    await h.prisma.listing.update({ where: { id: listingId }, data: { status: 'WITHDRAWN' } });
    const detail = await workspace(ticket.id);
    expect(detail.vehicle).toMatchObject({ listingStatus: 'WITHDRAWN', publicHref: null });
    expect(detail.enquiry?.id).toBe(enquiryId);
    await h.prisma.listing.update({ where: { id: listingId }, data: { status: 'ACTIVE' } });
  });

  it('lists the ticket on the enquiry’s own admin page', async () => {
    const ticket = await raise(neha, { enquiryId });
    const enquiry = (await admin.get(`/v1/admin/enquiries/${enquiryId}`).expect(200))
      .body as AdminEnquiryDetail;
    expect(enquiry.supportTickets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: ticket.id,
          reference: ticket.reference,
          statusLabel: 'Open',
        }),
      ]),
    );
  });

  it('answers 404 for a ticket that does not exist', async () => {
    const res = await admin
      .get('/v1/admin/support/tickets/00000000-0000-4000-8000-000000000000')
      .expect(404);
    expect(res.body.code).toBe('SUPPORT_TICKET_NOT_FOUND');
    await admin
      .post('/v1/admin/support/tickets/00000000-0000-4000-8000-000000000000/notes')
      .send({ note: 'x' })
      .expect(404);
  });
});

describe('reply and internal note', () => {
  it('sends a reply the customer sees as Dealers-Drive support', async () => {
    const ticket = await raise(neha);
    const res = await admin
      .post(`/v1/admin/support/tickets/${ticket.id}/messages`)
      .send({ message: 'We have asked the dealership to call you today.' })
      .expect(201);
    const detail = res.body as AdminSupportTicketDetail;
    expect(detail.messages).toEqual([
      expect.objectContaining({
        author: 'SUPPORT',
        authorLabel: 'Dealers-Drive support',
        authorName: 'Dealers-Drive Operations',
      }),
    ]);
    expect(detail.status).toBe('OPEN');

    const seen = (await neha.agent.get(`/v1/support/tickets/${ticket.id}`).expect(200))
      .body as CustomerSupportTicket;
    expect(seen.messages).toEqual([
      expect.objectContaining({
        author: 'SUPPORT',
        authorLabel: 'Dealers-Drive support',
        body: 'We have asked the dealership to call you today.',
      }),
    ]);
    const stored = await h.prisma.supportTicketMessage.findFirstOrThrow({
      where: { ticketId: ticket.id },
    });
    expect(stored).toMatchObject({ authorType: 'SUPPORT', authorId: adminId });
  });

  it('keeps an internal note away from the customer, and from the activity time they see', async () => {
    const ticket = await raise(neha);
    const before = await h.prisma.supportTicket.findUniqueOrThrow({ where: { id: ticket.id } });
    const secret = 'Called the dealer at 14:32; they say they rang twice.';

    const res = await admin
      .post(`/v1/admin/support/tickets/${ticket.id}/notes`)
      .send({ note: secret })
      .expect(201);
    expect((res.body as AdminSupportTicketDetail).notes).toEqual([
      expect.objectContaining({ body: secret, authorName: 'Dealers-Drive Operations' }),
    ]);

    const customerView = await neha.agent.get(`/v1/support/tickets/${ticket.id}`).expect(200);
    const customerList = await neha.agent.get('/v1/support/tickets?limit=50').expect(200);
    expect(JSON.stringify(customerView.body)).not.toContain(secret);
    expect(JSON.stringify(customerList.body)).not.toContain(secret);
    expect(JSON.stringify(customerView.body)).not.toContain('notes');
    expect((customerView.body as CustomerSupportTicket).messages).toEqual([]);

    const after = await h.prisma.supportTicket.findUniqueOrThrow({ where: { id: ticket.id } });
    expect(after.updatedAt.getTime()).toBe(before.updatedAt.getTime());
  });

  it('refuses an empty reply or note, and a reply posing as the customer', async () => {
    const ticket = await raise(neha);
    await admin
      .post(`/v1/admin/support/tickets/${ticket.id}/messages`)
      .send({ message: ' ' })
      .expect(400);
    await admin.post(`/v1/admin/support/tickets/${ticket.id}/notes`).send({ note: '' }).expect(400);
    await admin
      .post(`/v1/admin/support/tickets/${ticket.id}/messages`)
      .send({ message: 'Hi', authorType: 'CUSTOMER' })
      .expect(400);
  });
});

describe('status, priority and assignment', () => {
  it('moves status as the table allows, stamping and auditing each move', async () => {
    const ticket = await raise(neha);
    await patch(admin, ticket.id, { status: 'WAITING_FOR_CUSTOMER' }).expect(200);
    const customerSees = (await neha.agent.get(`/v1/support/tickets/${ticket.id}`).expect(200))
      .body as CustomerSupportTicket;
    expect(customerSees.statusLabel).toBe('Awaiting your reply');

    await neha.agent
      .post(`/v1/support/tickets/${ticket.id}/messages`)
      .send({ message: 'My number is the same.' })
      .expect(201);
    expect((await workspace(ticket.id)).status).toBe('IN_PROGRESS');

    const resolved = (await patch(admin, ticket.id, { status: 'RESOLVED' }).expect(200))
      .body as AdminSupportTicketDetail;
    expect(resolved.resolvedLabel).not.toBeNull();
    expect(resolved.transitions).toEqual(['OPEN', 'CLOSED']);

    const reopened = (await patch(admin, ticket.id, { status: 'OPEN' }).expect(200))
      .body as AdminSupportTicketDetail;
    expect(reopened.resolvedLabel).toBeNull();

    const closed = (await patch(admin, ticket.id, { status: 'CLOSED' }).expect(200))
      .body as AdminSupportTicketDetail;
    expect(closed).toMatchObject({ canReply: false, transitions: [] });
    expect(closed.closedLabel).not.toBeNull();

    expect(closed.history.map((entry) => [entry.label, entry.detail])).toEqual([
      ['Request created', null],
      ['Status changed', 'Open → Waiting for customer'],
      ['Status changed', 'Waiting for customer → In progress after the customer replied'],
      ['Resolved', 'In progress → Resolved'],
      ['Reopened', 'Resolved → Open'],
      ['Closed', 'Open → Closed'],
    ]);
    expect(closed.history[1]?.actor).toBe('Dealers-Drive · Dealers-Drive Operations');
    expect(closed.history[2]?.actor).toBe('Customer');
  });

  it('refuses a move the table does not allow, and changes nothing', async () => {
    const ticket = await raise(neha);
    await patch(admin, ticket.id, { status: 'RESOLVED' }).expect(200);
    const refused = await patch(admin, ticket.id, {
      status: 'WAITING_FOR_CUSTOMER',
      priority: 'HIGH',
    }).expect(409);
    expect(refused.body.code).toBe('SUPPORT_TICKET_TRANSITION');
    const row = await h.prisma.supportTicket.findUniqueOrThrow({ where: { id: ticket.id } });
    expect(row).toMatchObject({ status: 'RESOLVED', priority: 'NORMAL' });

    await patch(admin, ticket.id, { status: 'CLOSED' }).expect(200);
    expect((await patch(admin, ticket.id, { status: 'OPEN' }).expect(409)).body.code).toBe(
      'SUPPORT_TICKET_TRANSITION',
    );
    const reply = await admin
      .post(`/v1/admin/support/tickets/${ticket.id}/messages`)
      .send({ message: 'One more thing' })
      .expect(409);
    expect(reply.body.code).toBe('SUPPORT_TICKET_CLOSED');
  });

  it('sets priority without moving the activity time the customer sees, and audits it', async () => {
    const ticket = await raise(neha);
    const before = await h.prisma.supportTicket.findUniqueOrThrow({ where: { id: ticket.id } });
    const detail = (await patch(admin, ticket.id, { priority: 'HIGH' }).expect(200))
      .body as AdminSupportTicketDetail;
    expect(detail).toMatchObject({ priority: 'HIGH', priorityLabel: 'High' });
    expect(detail.history.at(-1)).toMatchObject({
      label: 'Priority changed',
      detail: 'Normal → High',
    });

    const after = await h.prisma.supportTicket.findUniqueOrThrow({ where: { id: ticket.id } });
    expect(after.updatedAt.getTime()).toBe(before.updatedAt.getTime());
    const customerView = await neha.agent.get(`/v1/support/tickets/${ticket.id}`).expect(200);
    expect(JSON.stringify(customerView.body)).not.toContain('HIGH');
  });

  it('assigns to an active admin, reassigns and unassigns, and refuses anybody else', async () => {
    const ticket = await raise(neha);
    const mine = (await patch(admin, ticket.id, { assignedAdminId: adminId }).expect(200))
      .body as AdminSupportTicketDetail;
    expect(mine.assignee?.id).toBe(adminId);
    expect((await queue('?assignee=me&limit=100')).data.map((row) => row.id)).toContain(ticket.id);

    const theirs = (await patch(admin, ticket.id, { assignedAdminId: colleagueId }).expect(200))
      .body as AdminSupportTicketDetail;
    expect(theirs.assignee).toMatchObject({ id: colleagueId, label: colleagueLabel });

    const none = (await patch(admin, ticket.id, { assignedAdminId: null }).expect(200))
      .body as AdminSupportTicketDetail;
    expect(none.assignee).toBeNull();
    expect(none.history.slice(-3).map((entry) => [entry.label, entry.detail])).toEqual([
      ['Assigned', 'to Dealers-Drive Operations'],
      ['Assigned', `to ${colleagueLabel}`],
      ['Unassigned', null],
    ]);

    const refused = await patch(admin, ticket.id, { assignedAdminId: neha.id }).expect(422);
    expect(refused.body.code).toBe('SUPPORT_ASSIGNEE_INVALID');
    await patch(admin, ticket.id, {
      assignedAdminId: '00000000-0000-4000-8000-000000000000',
    }).expect(422);
  });

  it('refuses an empty change and a field it does not know', async () => {
    const ticket = await raise(neha);
    await patch(admin, ticket.id, {}).expect(400);
    await patch(admin, ticket.id, { customerId: vikram.id }).expect(400);
    await patch(admin, ticket.id, { priority: 'CRITICAL' }).expect(400);
  });

  it('records nothing when the change is no change', async () => {
    const ticket = await raise(neha);
    await patch(admin, ticket.id, {
      status: 'OPEN',
      priority: 'NORMAL',
      assignedAdminId: null,
    }).expect(200);
    const trail = await h.prisma.auditLog.count({
      where: { entityType: 'SupportTicket', entityId: ticket.id },
    });
    expect(trail).toBe(1);
  });
});
