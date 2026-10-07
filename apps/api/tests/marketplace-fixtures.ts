import { randomInt } from 'node:crypto';

import type request from 'supertest';

import { env } from '../src/config/env.js';
import type { AuthHarness } from './auth-harness.js';

/**
 * Signed-in people for the vehicle, listing and moderation suites.
 *
 * Every agent here goes through the real sign-in: the cookie resolver, the
 * session row and the guards are production code, so a tenant-isolation test
 * written against these agents is a test of the thing a real dealer meets —
 * not of a principal somebody constructed by hand.
 */
export interface Dealership {
  agent: request.Agent;
  dealerId: string;
  userId: string;
  slug: string;
}

/** Every field `vehicleIssues()` asks for, so a vehicle can be submitted. */
export const COMPLETE_VEHICLE = {
  make: 'Hyundai',
  model: 'Creta',
  variant: 'SX(O)',
  manufacturingYear: 2023,
  registrationYear: 2023,
  fuelType: 'PETROL',
  transmission: 'AUTOMATIC',
  bodyType: 'SUV',
  kilometersDriven: 22_400,
  ownerCount: 1,
  color: 'WHITE',
  insuranceType: 'COMPREHENSIVE',
  insuranceValidUntil: '2027-03-31',
  pricePaise: 145_000_000,
  negotiability: 'FIXED',
  description: 'Single owner.',
};

let sequence = 0;

function next(): number {
  sequence += 1;
  return sequence;
}

export function marketplaceFixtures(h: AuthHarness, label: string) {
  async function dealership(
    status: 'DRAFT' | 'PENDING_APPROVAL' | 'ACTIVE' = 'ACTIVE',
  ): Promise<Dealership> {
    const n = next();
    h.google.claims = {
      subject: `${label}-dealer-${n}`,
      email: `${label}.dealer${n}@example.com`,
      emailVerified: true,
      name: 'Fixture Dealer',
    };
    const agent = h.agent();
    await h.signIn(agent);

    // Random, not clock-derived: the clock's last five digits repeat every 100 s,
    // and two test files running in parallel then mint the same number.
    const phone = `97${String(randomInt(0, 100_000_000)).padStart(8, '0')}`;
    await h.proveNumber(agent, phone);
    const created = await agent
      .post('/v1/auth/onboarding')
      .send({
        fullName: 'Fixture Owner',
        phone,
        legalName: `${label} Motors ${n} ${Date.now()}`,
        addressLine: '18, Gandhi Road',
        city: 'Katpadi',
        district: 'Vellore',
        state: 'Tamil Nadu',
        pincode: '632007',
        mapsUrl: 'https://maps.app.goo.gl/fixture',
        tagline: 'A dealership that exists for a test suite.',
        specialities: ['Hatchbacks'],
      })
      .expect(201);

    const dealerId = created.body.dealer.id as string;
    if (status !== 'DRAFT') {
      await h.prisma.dealer.update({
        where: { id: dealerId },
        data: { status, ...(status === 'ACTIVE' ? { approvedAt: new Date() } : {}) },
      });
    }

    const member = await h.prisma.dealerMember.findFirstOrThrow({ where: { dealerId } });
    return { agent, dealerId, userId: member.userId, slug: created.body.dealer.slug as string };
  }

  /**
   * A second person in an existing dealership (**R92**), signed in through the
   * real dealer phone sign-in. The membership row is written directly — the
   * invitation flow that produces it in production has its own suite.
   */
  async function member(of: Dealership, role: 'OWNER' | 'MANAGER' | 'STAFF'): Promise<Dealership> {
    const n = next();
    const phone = `93${String(Date.now()).slice(-5)}${String(100 + n).slice(-3)}`;
    const agent = h.agent();
    await agent
      .post('/v1/auth/sign-in/phone/dealer')
      .send({
        phone,
        accessToken: `dev-otp:91${phone}:${env.PHONE_OTP_DEV_CODE}:${label}-member-${String(n)}`,
      })
      .expect(200);
    const user = await h.prisma.user.findUniqueOrThrow({ where: { phone: `+91${phone}` } });
    await h.prisma.user.update({
      where: { id: user.id },
      data: { fullName: `${role[0]}${role.slice(1).toLowerCase()} ${String(n)}` },
    });
    await h.prisma.dealerMember.create({
      data: { dealerId: of.dealerId, userId: user.id, role, permissions: [] },
    });
    return { agent, dealerId: of.dealerId, userId: user.id, slug: of.slug };
  }

  async function moderator(): Promise<request.Agent> {
    const n = next();
    h.google.claims = {
      subject: `${label}-moderator-${n}`,
      email: env.adminAllowlist[0] ?? '',
      emailVerified: true,
      name: 'Dealers-Drive Operations',
    };
    const agent = h.agent();
    await h.signInAdmin(agent);
    return agent;
  }

  return { dealership, member, moderator };
}
