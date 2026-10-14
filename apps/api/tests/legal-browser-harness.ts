import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';

import { LEGAL_VERSION, PRIVACY_VERSION, UpdateVehicleInput } from '@dealers-drive/contracts';

import { createAuthHarness, createFakeGoogle } from './auth-harness.js';
import { COMPLETE_VEHICLE } from './marketplace-fixtures.js';

if (
  process.env.DATABASE_URL !==
    'postgresql://dealersdrive:dealersdrive@localhost:5432/dealersdrive_test' ||
  process.env.PHONE_OTP_DRIVER !== 'fake' ||
  process.env.STORAGE_DRIVER !== 'local' ||
  process.env.APP_ENV !== 'local'
) {
  throw new Error('Only the isolated local test database and fake providers are permitted.');
}

const h = await createAuthHarness(createFakeGoogle());
const server = h.app.listen(43999, '127.0.0.1');
let sequence = Date.now() % 8000;
const agreement = {
  version: LEGAL_VERSION,
  accepted: true,
  privacyAcknowledged: true,
  privacyVersion: PRIVACY_VERSION,
};
const phone = () => `98776${String(10000 + ++sequence)}`;
async function dealer(name: string) {
  const stamp = randomUUID();
  h.google.claims = { subject: stamp, email: `${stamp}@example.test`, emailVerified: true, name };
  const agent = h.agent();
  await h.signIn(agent);
  const number = phone();
  await h.proveNumber(agent, number);
  const created = await agent
    .post('/v1/auth/onboarding')
    .send({
      fullName: name,
      phone: number,
      legalName: `${name} ${stamp.slice(0, 8)}`,
      addressLine: '18 Synthetic Browser Road',
      city: 'Katpadi',
      district: 'Vellore',
      state: 'Tamil Nadu',
      pincode: '632007',
      mapsUrl: 'https://www.google.com/maps?q=12.9165,79.1325',
      specialities: ['Used cars'],
    })
    .expect(201);
  const id = String(created.body.dealer.id);
  await h.prisma.dealer.update({
    where: { id },
    data: { status: 'ACTIVE', approvedAt: new Date() },
  });
  await agent
    .post('/v1/legal/dealer/dealer-agreement')
    .send({ ...agreement, authorityConfirmed: true })
    .expect(200);
  const row = await h.prisma.dealer.findUniqueOrThrow({ where: { id } });
  return { id, name: row.brandName };
}
async function car(dealerId: string) {
  const vehicle = await h.prisma.vehicle.create({
    data: {
      ...UpdateVehicleInput.parse(COMPLETE_VEHICLE),
      insuranceValidUntil: new Date(COMPLETE_VEHICLE.insuranceValidUntil),
      dealerId,
      registrationNumber: `TN23BR${String(1000 + ++sequence)}`,
    },
  });
  const listing = await h.prisma.listing.create({
    data: {
      dealerId,
      vehicleId: vehicle.id,
      status: 'ACTIVE',
      slug: `browser-${randomUUID()}`,
      publishedAt: new Date(),
    },
  });
  return listing.slug;
}
const x = await dealer('Browser Dealer X');
const y = await dealer('Browser Dealer Y');
const cars = {
  first: await car(x.id),
  second: await car(x.id),
  afterWithdrawal: await car(x.id),
  unrelated: await car(y.id),
};
const buyer = h.agent();
const number = phone();
const proof = await buyer
  .post('/v1/auth/sign-in/phone/customer')
  .send({ phone: number, accessToken: `dev-otp:91${number}:123456:${randomUUID()}` })
  .expect(200);
const signup = await buyer
  .post('/v1/auth/sign-up/customer')
  .send({ signUpToken: proof.body.signUpToken, fullName: 'Synthetic Browser Buyer', agreement })
  .expect(201);
const raw: unknown = signup.headers['set-cookie'];
const cookies = (Array.isArray(raw) ? raw : [])
  .filter((value): value is string => typeof value === 'string')
  .map((value) => value.split(';')[0])
  .filter((value): value is string => value !== undefined)
  .map((value) => {
    const split = value.indexOf('=');
    return {
      name: value.slice(0, split),
      value: value.slice(split + 1),
      url: 'http://127.0.0.1:3120',
      httpOnly: true,
      sameSite: 'Lax',
    };
  });
await writeFile(
  '/private/tmp/dealersdrive-legal-browser-fixture.json',
  JSON.stringify({ x, y, cars, cookies }),
  { mode: 0o600 },
);
process.stdout.write('Synthetic full-stack browser fixture ready on localhost:43999.\n');
async function close() {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await h.close();
}
process.on('SIGTERM', () => void close());
process.on('SIGINT', () => void close());
