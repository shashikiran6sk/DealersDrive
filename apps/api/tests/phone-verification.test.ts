import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { AuthHarness } from './auth-harness.js';
import { createAuthHarness, createFakeGoogle } from './auth-harness.js';

/**
 * R39 — the mobile number is proved, not typed.
 *
 * The unit tests cover what the service decides; these cover the parts that
 * only exist once a real database and a real router are involved:
 *
 *   · the two routes are **behind the session**, which is the only gate this
 *     product has on MSG91 spend — the widget sends the SMS from the browser,
 *     so handing `widgetId` and `tokenAuth` to an anonymous caller would hand
 *     the internet a way to spend the account's balance;
 *   · `users.phone` is written by this endpoint and by nothing else, and the
 *     unique index behind it holds when two accounts claim one number;
 *   · a dealership cannot be built around a number nobody proved.
 */
let h: AuthHarness;
let counter = 0;

function newAccount(): void {
  counter += 1;
  h.google.claims = {
    subject: `phone-sub-${counter}`,
    email: `phone${counter}@example.com`,
    emailVerified: true,
    name: 'Test Dealer',
  };
}

/** A number nothing else in the suite or the seed holds. */
function freeNumber(): string {
  return `98422${String(10000 + counter).slice(-5)}`;
}

async function signedIn() {
  newAccount();
  const agent = h.agent();
  await h.signIn(agent);
  return agent;
}

function devToken(phone: string, code = '123456', nonce = String(Date.now())): string {
  return `dev-otp:91${phone.replace(/\D/g, '').slice(-10)}:${code}:${nonce}`;
}

beforeAll(async () => {
  h = await createAuthHarness(createFakeGoogle());
});

afterAll(async () => {
  await h.close();
});

describe('the widget configuration', () => {
  /**
   * The spend control. Every other reason this could be public is outweighed
   * by the one reason it must not be: these two strings are what the browser
   * needs to make MSG91 send a message, and the API cannot count those.
   */
  it('is refused without a session', async () => {
    await h.agent().get('/v1/auth/phone/widget').expect(401);
  });

  it('never carries the auth key that can spend the account', async () => {
    const agent = await signedIn();
    const config = await agent.get('/v1/auth/phone/widget').expect(200);

    expect(config.body).toMatchObject({ enabled: true, driver: 'fake' });
    expect(JSON.stringify(config.body)).not.toContain('authkey');
    expect(JSON.stringify(config.body)).not.toContain('MSG91_AUTH_KEY');
  });

  it('is never cached, because it is answered per session', async () => {
    const agent = await signedIn();
    const config = await agent.get('/v1/auth/phone/widget').expect(200);

    expect(config.headers['cache-control']).toBe('no-store');
  });

  /** `GET /v1/config/public` is the one response a CDN may hold. Not this. */
  it('is not on the public bootstrap payload', async () => {
    const config = await h.agent().get('/v1/config/public').expect(200);

    expect(JSON.stringify(config.body)).not.toContain('widgetId');
    expect(JSON.stringify(config.body)).not.toContain('tokenAuth');
  });
});

describe('asking whether a number is free', () => {
  it('is refused without a session', async () => {
    await h.agent().post('/v1/auth/phone/availability').send({ phone: '9842200001' }).expect(401);
  });

  it('says yes to a number nobody holds', async () => {
    const agent = await signedIn();

    await agent.post('/v1/auth/phone/availability').send({ phone: freeNumber() }).expect(204);
  });

  it('says yes to the number this account already holds', async () => {
    const agent = await signedIn();
    const phone = freeNumber();
    await agent
      .post('/v1/auth/phone/verify')
      .send({ phone, accessToken: devToken(phone) })
      .expect(200);

    await agent.post('/v1/auth/phone/availability').send({ phone }).expect(204);
  });

  /**
   * The point of the endpoint: this refusal used to arrive *with the
   * verification*, which meant an SMS had already been paid for and delivered
   * to a handset whose owner never asked for one.
   */
  it('refuses a number another account holds, before anything is sent', async () => {
    const first = await signedIn();
    const phone = freeNumber();
    await first
      .post('/v1/auth/phone/verify')
      .send({ phone, accessToken: devToken(phone) })
      .expect(200);

    const second = await signedIn();
    const refused = await second.post('/v1/auth/phone/availability').send({ phone }).expect(409);

    expect(refused.body.code).toBe('PHONE_ALREADY_REGISTERED');
    // Named as the client sent it, so the wizard marks the box on step 1.
    expect(JSON.stringify(refused.body.errors)).toContain('body.phone');
  });

  /** It answers about the caller's own claim, and says nothing about anyone else. */
  it('never says who holds a taken number', async () => {
    const first = await signedIn();
    const phone = freeNumber();
    await first
      .post('/v1/auth/phone/verify')
      .send({ phone, accessToken: devToken(phone) })
      .expect(200);
    const holder = await h.prisma.user.findUnique({ where: { phone: `+91${phone}` } });

    const second = await signedIn();
    const refused = await second.post('/v1/auth/phone/availability').send({ phone }).expect(409);

    const body = JSON.stringify(refused.body);
    expect(body).not.toContain(holder?.id ?? 'no-holder');
    expect(body).not.toContain(holder?.email ?? 'no-email');
  });

  it('refuses something that is not an Indian mobile number', async () => {
    const agent = await signedIn();

    await agent.post('/v1/auth/phone/availability').send({ phone: '12345' }).expect(400);
  });

  /** Rule 2 — an unknown field is a 400 that names it. */
  it('refuses a body carrying anything else', async () => {
    const agent = await signedIn();

    const refused = await agent
      .post('/v1/auth/phone/availability')
      .send({ phone: freeNumber(), userId: 'someone-else' })
      .expect(400);

    expect(JSON.stringify(refused.body.errors)).toContain('userId');
  });
});

describe('proving a number', () => {
  it('is refused without a session', async () => {
    await h
      .agent()
      .post('/v1/auth/phone/verify')
      .send({ phone: '9842200001', accessToken: devToken('9842200001') })
      .expect(401);
  });

  it('writes the number and the moment it was proved', async () => {
    const agent = await signedIn();
    const phone = freeNumber();

    const result = await agent
      .post('/v1/auth/phone/verify')
      .send({ phone, accessToken: devToken(phone) })
      .expect(200);

    expect(result.body.phone).toBe(`+91${phone}`);

    const user = await h.prisma.user.findUnique({ where: { phone: `+91${phone}` } });
    expect(user?.phoneVerifiedAt).not.toBeNull();
  });

  it('shows on the session, so the screen knows not to ask again', async () => {
    const agent = await signedIn();
    const phone = freeNumber();

    const before = await agent.get('/v1/auth/me').expect(200);
    expect(before.body.user.phoneVerified).toBe(false);

    await agent
      .post('/v1/auth/phone/verify')
      .send({ phone, accessToken: devToken(phone) })
      .expect(200);

    const after = await agent.get('/v1/auth/me').expect(200);
    expect(after.body.user).toMatchObject({ phone: `+91${phone}`, phoneVerified: true });
  });

  /** The binding check: the token has to prove the number being claimed. */
  it('refuses a token that proves a different handset', async () => {
    const agent = await signedIn();
    const phone = freeNumber();

    const refused = await agent
      .post('/v1/auth/phone/verify')
      .send({ phone, accessToken: devToken('9899900001') })
      .expect(422);

    expect(refused.body.code).toBe('PHONE_VERIFICATION_FAILED');
    expect(await h.prisma.user.findUnique({ where: { phone: `+91${phone}` } })).toBeNull();
  });

  it('refuses a wrong code', async () => {
    const agent = await signedIn();
    const phone = freeNumber();

    await agent
      .post('/v1/auth/phone/verify')
      .send({ phone, accessToken: devToken(phone, '000000') })
      .expect(422);
  });

  /** One token, one verification — a captured one cannot be walked twice. */
  it('accepts a token once', async () => {
    const agent = await signedIn();
    const phone = freeNumber();
    const token = devToken(phone, '123456', 'once');

    await agent.post('/v1/auth/phone/verify').send({ phone, accessToken: token }).expect(200);
    await agent.post('/v1/auth/phone/verify').send({ phone, accessToken: token }).expect(422);
  });

  it('refuses a number another account has already proved', async () => {
    const first = await signedIn();
    const phone = freeNumber();
    await first
      .post('/v1/auth/phone/verify')
      .send({ phone, accessToken: devToken(phone) })
      .expect(200);

    const second = await signedIn();
    const refused = await second
      .post('/v1/auth/phone/verify')
      .send({ phone, accessToken: devToken(phone, '123456', 'other') })
      .expect(409);

    expect(refused.body.code).toBe('PHONE_ALREADY_REGISTERED');
  });

  it('lets an account re-prove the number it already holds', async () => {
    const agent = await signedIn();
    const phone = freeNumber();

    await agent
      .post('/v1/auth/phone/verify')
      .send({ phone, accessToken: devToken(phone) })
      .expect(200);
    await agent
      .post('/v1/auth/phone/verify')
      .send({ phone, accessToken: devToken(phone, '123456', 'again') })
      .expect(200);
  });

  /** Rule 2 — an unknown field is a 400 that names it, never a silent ignore. */
  it('refuses a body carrying anything else', async () => {
    const agent = await signedIn();
    const phone = freeNumber();

    const refused = await agent
      .post('/v1/auth/phone/verify')
      .send({ phone, accessToken: devToken(phone), userId: 'someone-else' })
      .expect(400);

    expect(refused.body.code).toBe('VALIDATION_FAILED');
    expect(JSON.stringify(refused.body.errors)).toContain('userId');
  });

  it('refuses something that is not an Indian mobile number', async () => {
    const agent = await signedIn();

    await agent
      .post('/v1/auth/phone/verify')
      .send({ phone: '12345', accessToken: devToken('12345') })
      .expect(400);
  });
});

describe('what a proved number unlocks', () => {
  const onboarding = (phone: string) => ({
    fullName: 'R. Manikandan',
    phone,
    legalName: `Proved Motors ${counter}`,
    addressLine: '18, Gandhi Road',
    city: 'Katpadi',
    district: 'Vellore',
    state: 'Tamil Nadu',
    pincode: '632007',
    mapsUrl: 'https://maps.app.goo.gl/phone-fixture',
    tagline: 'Family-run dealership in Katpadi, trading since 1998.',
    specialities: ['Hatchbacks'],
  });

  it('refuses the create until the number has been proved', async () => {
    const agent = await signedIn();
    const phone = freeNumber();

    const refused = await agent.post('/v1/auth/onboarding').send(onboarding(phone)).expect(422);
    expect(refused.body.code).toBe('PHONE_NOT_VERIFIED');

    await agent
      .post('/v1/auth/phone/verify')
      .send({ phone, accessToken: devToken(phone) })
      .expect(200);
    await agent.post('/v1/auth/onboarding').send(onboarding(phone)).expect(201);
  });

  /**
   * Proving one number does not licence sending another. The create asserts
   * against the number on the row, not against the fact that *some* number was
   * once verified.
   */
  it('refuses a create that names a different number from the proved one', async () => {
    const agent = await signedIn();
    const proved = freeNumber();
    await agent
      .post('/v1/auth/phone/verify')
      .send({ phone: proved, accessToken: devToken(proved) })
      .expect(200);

    const refused = await agent
      .post('/v1/auth/onboarding')
      .send(onboarding('9876500001'))
      .expect(422);

    expect(refused.body.code).toBe('PHONE_NOT_VERIFIED');
  });

  /** The dealership is built around the proved number, in both columns. */
  it('publishes the proved number as the dealership’s contact', async () => {
    const agent = await signedIn();
    const phone = freeNumber();

    await agent
      .post('/v1/auth/phone/verify')
      .send({ phone, accessToken: devToken(phone) })
      .expect(200);
    const created = await agent.post('/v1/auth/onboarding').send(onboarding(phone)).expect(201);

    const dealer = await h.prisma.dealer.findUnique({
      where: { id: created.body.dealer.id as string },
    });
    expect(dealer?.contactPhone).toBe(`+91${phone}`);
  });
});
