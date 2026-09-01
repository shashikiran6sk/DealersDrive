import type { Express } from 'express';
import type { DealerRole, PrismaClient } from '@prisma/client';
import request from 'supertest';

import { buildContainer } from '../src/container.js';
import type { CachePort } from '../src/platform/cache/cache.port.js';
import { createMemoryCache } from '../src/platform/cache/memory.adapter.js';
import {
  permissionsForAdminRole,
  permissionsForRole,
  type DealerPrincipal,
  type SessionResolver,
} from '../src/modules/auth/session.port.js';
import { createApp } from '../src/server.js';

/**
 * The suite's harness.
 *
 * The container's `sessions` override is the seam that makes tenant-isolation
 * testing possible at all: the production resolver reads a *server-configured*
 * identity, so there is no header a test (or an attacker) could set to become
 * another dealer. Here the identity is swapped by the harness, out of band, at
 * the same place production will one day read a cookie.
 */
export interface Harness {
  app: Express;
  prisma: PrismaClient;
  /**
   * The rate limiter's counter store, pinned to memory for the suite.
   *
   * Exposed so a test that turns the limits back on can start from an empty
   * window. Memory rather than the Postgres adapter on purpose: the counters
   * must die with the process, or one file's exhausted budget would be the next
   * file's starting state.
   */
  cache: CachePort;
  /**
   * Act as this dealer for every subsequent request, optionally as a member of
   * a given role. The role seam exists because §8.3's permission table is only
   * meaningfully tested from a seat that lacks the permission.
   */
  actAs(slug: string, role?: DealerRole): void;
  agent(): request.Agent;
  /**
   * Runs the outbox to exhaustion.
   *
   * Indexing, notification and revalidation are deliberately asynchronous — an
   * approval must not roll back because a search write failed (§10) — so a test
   * that asserts on the catalogue has to advance the pipeline first. With
   * `JOBS_ENABLED=false` the queue runs handlers inline, so one drain is the
   * whole chain: outbox → bus → job handler → `listing_search`.
   */
  drain(): Promise<void>;
  close(): Promise<void>;
}

/** The two seeded dealers the isolation tests use. */
export const DEALER_A = 'sri-lakshmi-motors';
export const DEALER_B = 'velavan-cars';

export async function createHarness(): Promise<Harness> {
  let currentSlug = DEALER_A;
  let currentRole: DealerRole = 'OWNER';

  const cache = createMemoryCache();

  const container = await buildContainer({
    sessions: switchableSessions(() => ({ slug: currentSlug, role: currentRole })),
    cache,
  });

  const app = createApp(container);

  return {
    app,
    prisma: container.prisma,
    cache,
    actAs(slug: string, role: DealerRole = 'OWNER') {
      currentSlug = slug;
      currentRole = role;
    },
    agent: () => request.agent(app),
    async drain() {
      // A handler can enqueue further work, so drain until the table is quiet.
      for (let pass = 0; pass < 10; pass += 1) {
        if ((await container.outbox.drain()) === 0) return;
      }
    },
    async close() {
      await cache.reset();
      await container.prisma.$disconnect();
    },
  };
}

/**
 * A `SessionResolver` that reads the dealer the harness has selected. It is
 * otherwise identical to the development resolver: the principal is rebuilt
 * from the database on every request, so a dealer suspended mid-test loses
 * access on the next call, exactly as production sessions will.
 */
function switchableSessions(seatOf: () => { slug: string; role: DealerRole }): SessionResolver {
  let prisma: PrismaClient | null = null;

  const client = async (): Promise<PrismaClient> => {
    if (!prisma) {
      const { PrismaClient: Client } = await import('@prisma/client');
      prisma = new Client();
    }
    return prisma;
  };

  async function resolveDealer(): Promise<DealerPrincipal | null> {
    const db = await client();
    const seat = seatOf();
    const dealer = await db.dealer.findUnique({
      where: { slug: seat.slug },
      include: {
        members: {
          where: { status: 'ACTIVE', role: seat.role },
          take: 1,
          orderBy: { id: 'asc' },
        },
      },
    });

    const membership = dealer?.members[0];
    if (!dealer || !membership) return null;

    return {
      kind: 'DEALER',
      userId: membership.userId,
      dealerId: dealer.id,
      dealerSlug: dealer.slug,
      role: membership.role,
      dealerStatus: dealer.status,
      permissions: permissionsForRole(membership.role),
    };
  }

  return {
    resolveDealer,
    // The selected dealer always exists, so the harness has no pending state to
    // model. `tests/auth.test.ts` drives the real resolver for that.
    resolveSignedIn: resolveDealer,

    async resolveAdmin() {
      const db = await client();
      const user = await db.user.findFirst({
        where: { email: 'ops@dealers-drive.in', isPlatformAdmin: true },
      });
      if (!user?.adminRole) return null;

      return {
        kind: 'ADMIN',
        userId: user.id,
        email: user.email ?? 'ops@dealers-drive.in',
        adminRole: user.adminRole,
        permissions: permissionsForAdminRole(user.adminRole),
      };
    },
  };
}
