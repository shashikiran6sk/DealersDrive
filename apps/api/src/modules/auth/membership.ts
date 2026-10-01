import type { Dealer, DealerMember, Prisma, PrismaClient } from '@prisma/client';

type Db = PrismaClient | Prisma.TransactionClient;

export type MembershipWithDealer = DealerMember & { dealer: Dealer };

export interface WorkspaceMembership {
  membership: MembershipWithDealer | null;
  suspended: boolean;
}

export function isEnterable(membership: MembershipWithDealer): boolean {
  return membership.status === 'ACTIVE' && membership.dealer.status !== 'SUSPENDED';
}

export async function activeMemberships(db: Db, userId: string): Promise<MembershipWithDealer[]> {
  return db.dealerMember.findMany({
    where: { userId, status: 'ACTIVE' },
    include: { dealer: true },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });
}

export async function findWorkspaceMembership(
  db: Db,
  userId: string,
): Promise<WorkspaceMembership> {
  const memberships = await activeMemberships(db, userId);
  return {
    membership: memberships.find(isEnterable) ?? null,
    suspended: memberships.length > 0 && !memberships.some(isEnterable),
  };
}
