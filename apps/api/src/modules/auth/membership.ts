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

export function chooseWorkspace(
  memberships: readonly MembershipWithDealer[],
  preferredDealerId?: string | null,
): MembershipWithDealer | null {
  const enterable = memberships.filter(isEnterable);
  return (
    enterable.find((membership) => membership.dealerId === preferredDealerId) ??
    enterable[0] ??
    null
  );
}

export async function findWorkspaceMembership(
  db: Db,
  userId: string,
  preferredDealerId?: string | null,
): Promise<WorkspaceMembership> {
  const memberships = await activeMemberships(db, userId);
  return {
    membership: chooseWorkspace(memberships, preferredDealerId),
    suspended: memberships.length > 0 && !memberships.some(isEnterable),
  };
}
