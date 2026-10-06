import type request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { env } from '../src/config/env.js';
import { createAuthHarness, createFakeGoogle, type AuthHarness } from './auth-harness.js';

/**
 * R112 — a Sales Representative onboards a dealership with the dealer.
 *
 * The phone is proved on the dealer's handset by OTP, the email is captured
 * unverified, the documents go up the ordinary private path, and submission
 * enters the ordinary review — the same row, the same lifecycle, the same
 * emails. The representative never decides anything, and never sees a
 * dealership they did not assist.
 */
let h: AuthHarness;
let superAdmin: request.Agent;
let sales: request.Agent;
let otherSales: request.Agent;
let salesEmail: string;
let counter = 0;
let tokens = 0;

const JPEG = Buffer.from('\xff\xd8\xff a photograph of a yard', 'binary');

beforeAll(async () => {
  h = await createAuthHarness(createFakeGoogle());
  h.google.claims = {
    subject: 'sales-suite-super',
    email: env.adminAllowlist[0] ?? '',
    emailVerified: true,
    name: 'Dealers-Drive Operations',
  };
  superAdmin = h.agent();
  await h.signInAdmin(superAdmin);
  salesEmail = nextEmail('field.rep');
  sales = await member(salesEmail, 'SALES_REP');
  otherSales = await member(nextEmail('other.rep'), 'SALES_REP');
});

afterAll(async () => {
  await h.close();
});

function nextEmail(label: string): string {
  counter += 1;
  return `${label}.${String(counter)}.${Date.now().toString(36)}@dealers-drive.test`;
}

function freeNumber(): string {
  counter += 1;
  return `96622${String(10000 + counter).slice(-5)}`;
}

function devToken(phone: string, code: string = env.PHONE_OTP_DEV_CODE): string {
  tokens += 1;
  return `dev-otp:91${phone.slice(-10)}:${code}:sales-${String(tokens)}`;
}

async function member(email: string, role: string): Promise<request.Agent> {
  await superAdmin.post('/v1/admin/members').send({ email, role }).expect(201);
  counter += 1;
  h.google.claims = { subject: `sales-suite-${String(counter)}`, email, emailVerified: true };
  const agent = h.agent();
  await h.signInAdmin(agent);
  return agent;
}

async function verify(agent: request.Agent, phone = freeNumber()) {
  const res = await agent
    .post('/v1/sales/dealers/phone/verify')
    .send({ phone, accessToken: devToken(phone), consent: true })
    .expect(200);
  return { phone, ticket: res.body.phoneTicket as string, body: res.body };
}

function details(ticket: string, overrides: Record<string, unknown> = {}) {
  counter += 1;
  return {
    phoneTicket: ticket,
    contactName: 'Murugan S',
    email: `murugan.${String(counter)}@gmail.com`,
    legalName: `Assisted Motors ${String(counter)} ${Date.now().toString(36)}`,
    addressLine: '7, Arcot Road',
    city: 'Katpadi',
    district: 'Vellore',
    state: 'Tamil Nadu',
    pincode: '632007',
    mapsUrl: 'https://maps.app.goo.gl/assisted',
    tagline: 'Family-run since 1998, hatchbacks under six lakh.',
    specialities: ['Hatchbacks'],
    gstin: `33ASSTD${String(1000 + counter)}B1ZX`,
    pan: `ASSTD${String(1000 + counter)}B`,
    ...overrides,
  };
}

async function draft(agent: request.Agent = sales) {
  const { phone, ticket } = await verify(agent);
  const created = await agent.post('/v1/sales/dealers').send(details(ticket)).expect(201);
  return { phone, dealer: created.body as { id: string; email: string } };
}

async function completeDocuments(agent: request.Agent, dealerId: string) {
  for (const type of ['GST_CERTIFICATE', 'PAN_CARD', 'ADDRESS_PROOF']) {
    const presigned = await agent
      .post(`/v1/sales/dealers/${dealerId}/documents/presign`)
      .send({ type, fileName: 'doc.pdf', mimeType: 'application/pdf', bytes: 8 })
      .expect(201);
    const url = new URL(presigned.body.uploadUrl as string);
    await agent
      .put(url.pathname + url.search)
      .set('Content-Type', 'application/pdf')
      .send(Buffer.from('%PDF-1.4'))
      .expect(200);
    await agent
      .post(`/v1/sales/dealers/${dealerId}/documents/${type}/commit`)
      .send({ documentId: presigned.body.documentId })
      .expect(200);
  }
  const photo = await agent
    .post(`/v1/sales/dealers/${dealerId}/yard-photo/presign`)
    .send({ fileName: 'yard.jpg', mimeType: 'image/jpeg', bytes: JPEG.length })
    .expect(201);
  const photoUrl = new URL(photo.body.uploadUrl as string);
  await agent
    .put(photoUrl.pathname + photoUrl.search)
    .set('Content-Type', 'image/jpeg')
    .send(JPEG)
    .expect(200);
  await agent
    .post(`/v1/sales/dealers/${dealerId}/yard-photo/commit`)
    .send({ mediaId: photo.body.mediaId })
    .expect(200);
}

describe('verifying the dealer’s phone', () => {
  it('hands the representative the OTP widget configuration, never a secret', async () => {
    const res = await sales.get('/v1/sales/phone/widget').expect(200);
    expect(res.body).toMatchObject({ enabled: true, driver: 'fake' });
    expect(JSON.stringify(res.body)).not.toMatch(/authkey|secret/i);
    await h.agent().get('/v1/sales/phone/widget').expect(401);
  });

  it('needs the dealer’s consent', async () => {
    const phone = freeNumber();
    const res = await sales
      .post('/v1/sales/dealers/phone/verify')
      .send({ phone, accessToken: devToken(phone), consent: false })
      .expect(400);
    expect(JSON.stringify(res.body)).toContain('consent');
  });

  it('refuses a wrong code, a provider-refused (expired) token and a replay', async () => {
    const phone = freeNumber();
    await sales
      .post('/v1/sales/dealers/phone/verify')
      .send({ phone, accessToken: devToken(phone, '000000'), consent: true })
      .expect(422);
    await sales
      .post('/v1/sales/dealers/phone/verify')
      .send({ phone, accessToken: 'expired-provider-token', consent: true })
      .expect(422);
    const token = devToken(phone);
    await sales
      .post('/v1/sales/dealers/phone/verify')
      .send({ phone, accessToken: token, consent: true })
      .expect(200);
    await sales
      .post('/v1/sales/dealers/phone/verify')
      .send({ phone, accessToken: token, consent: true })
      .expect(422);
  });

  it('records the verification without the code or the token', async () => {
    const { body } = await verify(sales);
    expect(body.phoneTicket).toBeTruthy();
    const audit = await h.prisma.auditLog.findFirstOrThrow({
      where: { action: 'dealer.assisted.phone_verified' },
      orderBy: { id: 'desc' },
    });
    const serialised = JSON.stringify(audit);
    expect(serialised).not.toContain(env.PHONE_OTP_DEV_CODE);
    expect(serialised).not.toContain('dev-otp');
    expect(audit.after).toMatchObject({ consent: true, phoneLast4: expect.any(String) });
  });

  it('refuses a number that already belongs to a dealership', async () => {
    const { phone } = await draft();
    const refused = await sales
      .post('/v1/sales/dealers/phone/verify')
      .send({ phone, accessToken: devToken(phone), consent: true })
      .expect(409);
    expect(refused.body.code).toBe('DEALER_PHONE_TAKEN');
  });
});

describe('creating the dealership', () => {
  it('is an ASSISTED draft: phone verified, email unverified, attributed, not owned', async () => {
    const { phone, dealer } = await draft();
    const row = await h.prisma.dealer.findUniqueOrThrow({
      where: { id: dealer.id },
      include: { members: true, assistedBy: { include: { user: true } } },
    });
    expect(row).toMatchObject({
      status: 'DRAFT',
      onboardingSource: 'ASSISTED',
      contactPhone: `+91${phone}`,
      contactEmailVerifiedAt: null,
    });
    expect(row.contactPhoneVerifiedAt).toBeInstanceOf(Date);
    expect(row.assistedConsentAt).toBeInstanceOf(Date);
    expect(row.assistedBy?.user.email).toBe(salesEmail);
    expect(row.members).toHaveLength(0);
    expect(await h.prisma.user.count({ where: { email: row.contactEmail ?? 'none' } })).toBe(0);

    const audit = await h.prisma.auditLog.findFirstOrThrow({
      where: { action: 'dealer.assisted.created', entityId: dealer.id },
    });
    expect(audit.actorType).toBe('ADMIN');
  });

  it('spends the ticket once, and only for the member it was issued to', async () => {
    const { ticket } = await verify(sales);
    await otherSales.post('/v1/sales/dealers').send(details(ticket)).expect(422);
    await sales.post('/v1/sales/dealers').send(details(ticket)).expect(201);
    const again = await sales.post('/v1/sales/dealers').send(details(ticket)).expect(422);
    expect(again.body.code).toBe('PHONE_TICKET_EXPIRED');
    await sales
      .post('/v1/sales/dealers')
      .send(details(`${ticket}x`))
      .expect(422);
  });

  it('cannot be created with a typed number, or with a dealerId', async () => {
    const { ticket } = await verify(sales);
    await sales
      .post('/v1/sales/dealers')
      .send({ ...details(ticket), phone: '9840012345' })
      .expect(400);
    await sales
      .post('/v1/sales/dealers')
      .send({ ...details(ticket), dealerId: '00000000-0000-4000-8000-000000000001' })
      .expect(400);
  });
});

describe('preparing and submitting', () => {
  it('edits the draft, and clears email verification when the address changes', async () => {
    const { dealer } = await draft();
    await h.prisma.dealer.update({
      where: { id: dealer.id },
      data: { contactEmailVerifiedAt: new Date() },
    });

    const edited = await sales
      .patch(`/v1/sales/dealers/${dealer.id}`)
      .send({ contactName: 'Murugan Selvam', email: 'new.address@gmail.com' })
      .expect(200);
    expect(edited.body).toMatchObject({
      contactName: 'Murugan Selvam',
      email: 'new.address@gmail.com',
      emailVerified: false,
      canEdit: true,
    });
    await sales.patch(`/v1/sales/dealers/${dealer.id}`).send({ phone: '9840012345' }).expect(400);
  });

  it('runs the full journey through the ordinary review', async () => {
    const { dealer } = await draft();
    await completeDocuments(sales, dealer.id);

    const ready = await sales.get(`/v1/sales/dealers/${dealer.id}`).expect(200);
    expect(ready.body).toMatchObject({
      canSubmit: true,
      phoneVerified: true,
      emailVerified: false,
    });

    const before = h.mailer.sent.length;
    await sales.post(`/v1/sales/dealers/${dealer.id}/submit`).expect(200);
    await h.drainEmails();
    const mail = h.mailer.sent.slice(before);
    expect(mail.map((message) => message.to)).toEqual(
      expect.arrayContaining([dealer.email, ...env.adminAllowlist]),
    );
    expect(mail.find((message) => message.to === dealer.email)?.subject).toContain(
      'We have your application',
    );

    const submitted = await h.prisma.auditLog.findFirstOrThrow({
      where: { action: 'dealer.submitted', entityId: dealer.id },
    });
    expect(submitted.actorType).toBe('ADMIN');
    expect(submitted.after).toMatchObject({ onboardingSource: 'ASSISTED' });

    await sales.patch(`/v1/sales/dealers/${dealer.id}`).send({ contactName: 'Late' }).expect(409);

    const review = await superAdmin.get(`/v1/admin/dealers/${dealer.id}`).expect(200);
    expect(review.body.onboarding).toMatchObject({
      source: 'ASSISTED',
      sourceLabel: 'Assisted by Sales',
      assistedBy: { email: salesEmail },
      phoneVerified: true,
      phoneLabel: 'Verified',
      emailVerified: false,
      emailLabel: 'Pending verification',
      claimed: false,
      reviewerIsAssistant: false,
    });

    for (const action of ['approve', 'reject', 'suspend']) {
      const refused = await sales
        .post(`/v1/admin/dealers/${dealer.id}/${action}`)
        .send({ reason: 'Self approval attempt.' })
        .expect(403);
      expect(refused.body.code).toBe('ADMIN_CONSOLE_FORBIDDEN');
    }

    const docs = await h.prisma.dealerDocument.findMany({ where: { dealerId: dealer.id } });
    for (const doc of docs) {
      await superAdmin.post(`/v1/admin/documents/${doc.id}/verify`).send({}).expect(200);
    }
    const beforeApproval = h.mailer.sent.length;
    await superAdmin.post(`/v1/admin/dealers/${dealer.id}/approve`).send({}).expect(200);
    await h.drainEmails();
    expect(
      h.mailer.sent.slice(beforeApproval).find((message) => message.to === dealer.email)?.subject,
    ).toContain('is verified');

    const outcome = await sales.get(`/v1/sales/dealers/${dealer.id}`).expect(200);
    expect(outcome.body).toMatchObject({
      status: 'ACTIVE',
      statusLabel: 'Approved',
      canEdit: false,
    });
    const dashboard = await sales.get('/v1/sales/dashboard').expect(200);
    expect(
      dashboard.body.metrics.find((metric: { key: string }) => metric.key === 'approved').value,
    ).toBeGreaterThanOrEqual(1);
  });

  it('refuses submission until the application is complete', async () => {
    const { dealer } = await draft();
    const refused = await sales.post(`/v1/sales/dealers/${dealer.id}/submit`).expect(422);
    expect(refused.body.code).toBe('PROFILE_INCOMPLETE');
  });
});

describe('separation of duties', () => {
  it('refuses a reviewer the decisions on a dealership they assisted', async () => {
    const email = nextEmail('turncoat');
    const rep = await member(email, 'SALES_REP');
    const { dealer } = await draft(rep);
    await completeDocuments(rep, dealer.id);
    await rep.post(`/v1/sales/dealers/${dealer.id}/submit`).expect(200);

    const row = await h.prisma.adminMember.findFirstOrThrow({ where: { user: { email } } });
    await superAdmin.patch(`/v1/admin/members/${row.id}`).send({ role: 'MODERATOR' }).expect(200);

    const view = await rep.get(`/v1/admin/dealers/${dealer.id}`).expect(200);
    expect(view.body.onboarding.reviewerIsAssistant).toBe(true);
    expect(view.body.actions).toMatchObject({
      canApprove: false,
      canReject: false,
      canRequestChanges: false,
    });

    const docs = await h.prisma.dealerDocument.findMany({ where: { dealerId: dealer.id } });
    const doc = await rep.post(`/v1/admin/documents/${docs[0]?.id}/verify`).send({}).expect(403);
    expect(doc.body.code).toBe('SELF_REVIEW_FORBIDDEN');
    for (const action of ['approve', 'reject', 'request-changes', 'close']) {
      const refused = await rep
        .post(`/v1/admin/dealers/${dealer.id}/${action}`)
        .send(action === 'approve' ? {} : { reason: 'Approving my own work.' })
        .expect(403);
      expect(refused.body.code).toBe('SELF_REVIEW_FORBIDDEN');
    }
    const after = await h.prisma.dealer.findUniqueOrThrow({ where: { id: dealer.id } });
    expect(after.status).toBe('PENDING_APPROVAL');
  });
});

describe('scope', () => {
  it('hides another representative’s dealership behind a 404, on every route', async () => {
    const { dealer } = await draft(sales);
    const base = `/v1/sales/dealers/${dealer.id}`;
    const calls = [
      otherSales.get(base),
      otherSales.patch(base).send({ contactName: 'Hijack' }),
      otherSales
        .post(`${base}/documents/presign`)
        .send({ type: 'PAN_CARD', fileName: 'x.pdf', mimeType: 'application/pdf', bytes: 8 }),
      otherSales.delete(`${base}/documents/PAN_CARD`),
      otherSales
        .post(`${base}/yard-photo/presign`)
        .send({ fileName: 'y.jpg', mimeType: 'image/jpeg', bytes: 8 }),
      otherSales.post(`${base}/submit`),
    ];
    for (const call of calls) {
      const res = await call;
      expect(res.status).toBe(404);
      expect(res.body.code).toBe('ASSISTED_DEALER_NOT_FOUND');
    }
    const theirs = await otherSales.get('/v1/sales/dealers').expect(200);
    expect(theirs.body.data.some((row: { id: string }) => row.id === dealer.id)).toBe(false);
  });

  it('does not reach self-onboarded dealerships at all', async () => {
    const seeded = await h.prisma.dealer.findFirstOrThrow({
      where: { onboardingSource: 'SELF' },
    });
    await sales.get(`/v1/sales/dealers/${seeded.id}`).expect(404);
  });

  it('keeps console roles out of the Sales workspace, and dealers out of both', async () => {
    const refused = await superAdmin.get('/v1/sales/dashboard').expect(403);
    expect(refused.body.code).toBe('SALES_WORKSPACE_FORBIDDEN');
    await h.agent().get('/v1/sales/dashboard').expect(401);
    h.google.claims = {
      subject: 'sales-suite-dealer',
      email: nextEmail('dealer'),
      emailVerified: true,
    };
    const dealer = h.agent();
    await h.signIn(dealer);
    await dealer.get('/v1/sales/dashboard').expect(401);
  });

  it('lists only my dealerships, with counts, and filters by status', async () => {
    const list = await sales.get('/v1/sales/dealers?status=DRAFT').expect(200);
    expect(list.body.data.every((row: { status: string }) => row.status === 'DRAFT')).toBe(true);
    expect(list.body.counts.ALL).toBeGreaterThan(0);
    await sales.get('/v1/sales/dealers?status=NOPE').expect(400);
  });

  it('counts a rejected dealership as onboarded on the dashboard', async () => {
    const rep = await member(nextEmail('rejected.rep'), 'SALES_REP');
    const { dealer } = await draft(rep);
    await superAdmin
      .post(`/v1/admin/dealers/${dealer.id}/reject`)
      .send({ reason: 'The documents do not match the business.' })
      .expect(200);
    const dashboard = await rep.get('/v1/sales/dashboard').expect(200);
    expect(
      dashboard.body.metrics.find((metric: { key: string }) => metric.key === 'onboarded').value,
    ).toBe(1);
  });
});

describe('self-service onboarding is unchanged', () => {
  it('still records SELF and needs no assistant', async () => {
    h.google.claims = {
      subject: 'sales-suite-self',
      email: nextEmail('self'),
      emailVerified: true,
      name: 'Self Dealer',
    };
    const agent = h.agent();
    await h.signIn(agent);
    const phone = freeNumber();
    await h.proveNumber(agent, phone);
    const created = await agent
      .post('/v1/auth/onboarding')
      .send({
        fullName: 'Self Dealer',
        phone,
        legalName: `Self Motors ${Date.now().toString(36)}`,
        addressLine: '1, Main Road',
        city: 'Arcot',
        district: 'Ranipet',
        state: 'Tamil Nadu',
        pincode: '632503',
        mapsUrl: 'https://maps.app.goo.gl/self',
        tagline: 'Pre-owned cars, inspected before sale.',
        specialities: ['SUVs'],
      })
      .expect(201);
    const row = await h.prisma.dealer.findUniqueOrThrow({
      where: { id: created.body.dealer.id },
    });
    expect(row).toMatchObject({ onboardingSource: 'SELF', assistedByMemberId: null });
  });
});
