import type request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { env } from '../src/config/env.js';
import { createAuthHarness, createFakeGoogle, type AuthHarness } from './auth-harness.js';

/**
 * R62 — customers, by phone alone.
 *
 * A buyer proves their handset and, the first time, gives a name; nothing else
 * is asked, and nothing exists until both have happened. The suite runs the
 * production path end to end — the fake MSG91 driver, the sealed ticket, the
 * `sessions` row and the `dd_session` cookie — because every property worth
 * pinning here is a property of that path, not of one function.
 */
let h: AuthHarness;
let counter = 0;
let tokens = 0;

beforeAll(async () => {
  h = await createAuthHarness(createFakeGoogle());
});

afterAll(async () => {
  await h.close();
});

function freeNumber(): string {
  counter += 1;
  return `98455${String(10000 + counter).slice(-5)}`;
}

function devToken(phone: string, code: string = env.PHONE_OTP_DEV_CODE): string {
  tokens += 1;
  return `dev-otp:91${phone.slice(-10)}:${code}:customer-${String(tokens)}`;
}

function signIn(agent: request.Agent, phone: string, code?: string) {
  return agent
    .post('/v1/auth/sign-in/phone/customer')
    .send({ phone, accessToken: devToken(phone, code) });
}

function setsSession(res: request.Response): boolean {
  return [res.headers['set-cookie']].flat().some((c) => c?.startsWith('dd_session='));
}

async function newCustomer(fullName = 'Shashikiran') {
  const agent = h.agent();
  const phone = freeNumber();
  const proved = await signIn(agent, phone).expect(200);
  const created = await agent
    .post('/v1/auth/sign-up/customer')
    .send({ signUpToken: proved.body.signUpToken, fullName })
    .expect(201);
  return { agent, phone, customer: created.body.customer as { id: string } };
}

describe('a new customer', () => {
  it('is asked only for a name once the number is proved, and nothing exists yet', async () => {
    const phone = freeNumber();
    const before = await h.prisma.user.count();

    const res = await signIn(h.agent(), phone).expect(200);

    expect(res.body).toMatchObject({
      status: 'NAME_REQUIRED',
      customer: null,
      phoneDisplay: `+91 ${phone.slice(0, 5)} ${phone.slice(5)}`,
    });
    expect(res.body.signUpToken).toEqual(expect.any(String));
    expect(setsSession(res)).toBe(false);
    expect(await h.prisma.user.count()).toBe(before);
  });

  it('gives a name, and has an account and a session', async () => {
    const { agent, phone, customer } = await newCustomer('Shashikiran');

    const me = await agent.get('/v1/auth/customer/me').expect(200);
    expect(me.body.customer).toEqual({
      id: customer.id,
      fullName: 'Shashikiran',
      phone: `+91${phone}`,
      phoneDisplay: `+91 ${phone.slice(0, 5)} ${phone.slice(5)}`,
    });

    const user = await h.prisma.user.findUniqueOrThrow({
      where: { id: customer.id },
      include: { roles: true, identities: true },
    });
    expect(user).toMatchObject({ email: null, fullName: 'Shashikiran' });
    expect(user.phoneVerifiedAt).toBeInstanceOf(Date);
    expect(user.identities).toHaveLength(0);
    expect(user.roles.map((seat) => seat.role)).toEqual(['CUSTOMER']);

    const session = await h.prisma.session.findFirstOrThrow({
      where: { userId: customer.id, revokedAt: null },
    });
    expect(session.scope).toBe('CUSTOMER');
  });

  it.each(['ಶಶಿಕಿರಣ್', 'Nguyễn Thị Anh', "D'Souza", 'Mohammed Ali'])(
    'takes %j as a name',
    async (name) => {
      const { agent } = await newCustomer(name);
      const me = await agent.get('/v1/auth/customer/me').expect(200);
      expect(me.body.customer.fullName).toBe(name);
    },
  );

  it.each([
    ['', 'empty'],
    ['   ', 'blank'],
    ['1234', 'no letter'],
    ['a', 'too short'],
    ['x'.repeat(81), 'too long'],
    ['Ravi\u0007', 'a control character'],
  ])('refuses %j (%s)', async (fullName) => {
    const agent = h.agent();
    const proved = await signIn(agent, freeNumber()).expect(200);

    const res = await agent
      .post('/v1/auth/sign-up/customer')
      .send({ signUpToken: proved.body.signUpToken, fullName })
      .expect(400);
    expect(JSON.stringify(res.body)).toContain('fullName');
  });

  it.each(['email', 'phone', 'password', 'address'])(
    'refuses a %s at sign-up, by name',
    async (field) => {
      const agent = h.agent();
      const proved = await signIn(agent, freeNumber()).expect(200);

      const res = await agent
        .post('/v1/auth/sign-up/customer')
        .send({ signUpToken: proved.body.signUpToken, fullName: 'Ravi', [field]: 'x' })
        .expect(400);
      expect(JSON.stringify(res.body)).toContain(field);
    },
  );
});

describe('the sign-up ticket', () => {
  it('is spent on first use', async () => {
    const agent = h.agent();
    const proved = await signIn(agent, freeNumber()).expect(200);
    const body = { signUpToken: proved.body.signUpToken, fullName: 'Ravi' };

    await agent.post('/v1/auth/sign-up/customer').send(body).expect(201);
    const again = await h.agent().post('/v1/auth/sign-up/customer').send(body).expect(422);
    expect(again.body.code).toBe('SIGN_UP_EXPIRED');
  });

  it('cannot be edited to name another number', async () => {
    const agent = h.agent();
    const proved = await signIn(agent, freeNumber()).expect(200);
    const [body, signature] = String(proved.body.signUpToken).split('.');
    const edited = JSON.parse(Buffer.from(body ?? '', 'base64url').toString('utf8'));
    edited.phone = '+919840012345';
    const forged = `${Buffer.from(JSON.stringify(edited)).toString('base64url')}.${signature ?? ''}`;

    const res = await agent
      .post('/v1/auth/sign-up/customer')
      .send({ signUpToken: forged, fullName: 'Ravi' })
      .expect(422);
    expect(res.body.code).toBe('SIGN_UP_EXPIRED');
  });

  /** Two tabs, two proofs, one number: one account. */
  it('makes one account when two tickets for one number race', async () => {
    const phone = freeNumber();
    const first = await signIn(h.agent(), phone).expect(200);
    const second = await signIn(h.agent(), phone).expect(200);

    const results = await Promise.all([
      h
        .agent()
        .post('/v1/auth/sign-up/customer')
        .send({ signUpToken: first.body.signUpToken, fullName: 'Ravi' }),
      h
        .agent()
        .post('/v1/auth/sign-up/customer')
        .send({ signUpToken: second.body.signUpToken, fullName: 'Ravi K' }),
    ]);

    expect(results.map((res) => res.status)).toEqual([201, 201]);
    expect(results[0]?.body.customer.id).toBe(results[1]?.body.customer.id);
    expect(await h.prisma.user.count({ where: { phone: `+91${phone}` } })).toBe(1);
  });
});

describe('an existing customer', () => {
  it('signs straight in after the code — no name screen', async () => {
    const { phone, customer } = await newCustomer('Ravi');
    const agent = h.agent();

    const res = await signIn(agent, phone).expect(200);

    expect(res.body).toMatchObject({
      status: 'SIGNED_IN',
      signUpToken: null,
      customer: { id: customer.id, fullName: 'Ravi' },
    });
    expect(setsSession(res)).toBe(true);
    await agent.get('/v1/auth/customer/me').expect(200);
  });

  it('is refused while their customer seat is closed', async () => {
    const { phone, customer } = await newCustomer();
    await h.prisma.userRole.updateMany({
      where: { userId: customer.id, role: 'CUSTOMER' },
      data: { status: 'SUSPENDED' },
    });

    const res = await signIn(h.agent(), phone).expect(403);
    expect(res.body.code).toBe('ACCOUNT_SUSPENDED');
  });
});

describe('what a sign-in refuses, before anything is revealed', () => {
  it('a wrong code', async () => {
    const res = await signIn(h.agent(), freeNumber(), '000000').expect(422);
    expect(res.body.code).toBe('PHONE_VERIFICATION_FAILED');
    expect(setsSession(res)).toBe(false);
  });

  it('a token presented twice', async () => {
    const phone = freeNumber();
    const accessToken = devToken(phone);
    await h
      .agent()
      .post('/v1/auth/sign-in/phone/customer')
      .send({ phone, accessToken })
      .expect(200);
    const replay = await h
      .agent()
      .post('/v1/auth/sign-in/phone/customer')
      .send({ phone, accessToken })
      .expect(422);
    expect(replay.body.code).toBe('PHONE_VERIFICATION_FAILED');
  });

  it('a number that is not an Indian mobile, before any provider call', async () => {
    await h
      .agent()
      .post('/v1/auth/sign-in/phone/customer')
      .send({ phone: '0416224889', accessToken: 'dev-otp:910416224889:123456:x' })
      .expect(400);
  });
});

describe('one person, one account', () => {
  /**
   * A dealer's proved number on the Customer tab reaches the dealer's own
   * user: a customer seat is added, and no second account is made.
   */
  it('signs a dealer in as a customer on the same user', async () => {
    h.google.claims = {
      subject: `customer-dealer-${String(counter)}`,
      email: `customer.dealer${String(counter)}@example.com`,
      emailVerified: true,
      name: 'Karthik Raman',
    };
    const dealer = h.agent();
    await h.signIn(dealer);
    const phone = freeNumber();
    await h.proveNumber(dealer, phone);
    const dealerUser = await h.prisma.user.findUniqueOrThrow({ where: { phone: `+91${phone}` } });

    const res = await signIn(h.agent(), phone).expect(200);

    expect(res.body).toMatchObject({
      status: 'SIGNED_IN',
      customer: { id: dealerUser.id, fullName: 'Karthik Raman' },
    });
    const seats = await h.prisma.userRole.findMany({ where: { userId: dealerUser.id } });
    expect(seats.map((seat) => seat.role).sort()).toEqual(['CUSTOMER', 'DEALER']);
    expect(await h.prisma.user.count({ where: { phone: `+91${phone}` } })).toBe(1);

    /** And the dealer's own session is recognised as that customer too. */
    const me = await dealer.get('/v1/auth/customer/me').expect(200);
    expect(me.body.customer.id).toBe(dealerUser.id);
  });
});

describe('the customer session', () => {
  it('opens nothing in the dealer console', async () => {
    const { agent } = await newCustomer();

    await agent.get('/v1/auth/me').expect(401);
    await agent.get('/v1/dealer/dashboard').expect(401);
    await agent.post('/v1/auth/onboarding').send({}).expect(401);
  });

  it('is refused to nobody-in-particular', async () => {
    await h.agent().get('/v1/auth/customer/me').expect(401);
  });

  it('ends with the same revocation every sign-out uses', async () => {
    const { agent, customer } = await newCustomer();

    await agent.post('/v1/auth/customer/logout').expect(204);

    await agent.get('/v1/auth/customer/me').expect(401);
    const live = await h.prisma.session.count({
      where: { userId: customer.id, revokedAt: null },
    });
    expect(live).toBe(0);
  });

  it('records the sign-up in the audit log', async () => {
    const { customer } = await newCustomer();
    const row = await h.prisma.auditLog.findFirst({
      where: { entityId: customer.id, action: 'auth.identity.created' },
    });
    expect(row).toMatchObject({
      actorType: 'CUSTOMER',
      after: { provider: 'PHONE', seat: 'CUSTOMER' },
    });
  });
});
