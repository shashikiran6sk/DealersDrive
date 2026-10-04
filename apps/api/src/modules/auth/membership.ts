import type { Dealer, DealerMember, Prisma, PrismaClient } from '@prisma/client';

type Db = PrismaClient | Prisma.TransactionClient;

export type MembershipWithDealer = DealerMember & { dealer: Dealer };

export interface WorkspaceMembership {
  membership: MembershipWithDealer | null;
  suspended: boolean;
  closed: boolean;
}

const SHUT_DEALER_STATUSES: readonly Dealer['status'][] = ['SUSPENDED', 'CLOSED'];

export function isEnterable(membership: MembershipWithDealer): boolean {
  return membership.status === 'ACTIVE' && !SHUT_DEALER_STATUSES.includes(membership.dealer.status);
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
  const shut = memberships.length > 0 && !memberships.some(isEnterable);
  return {
    membership: chooseWorkspace(memberships, preferredDealerId),
    suspended: shut,
    closed: shut && memberships.every((membership) => membership.dealer.status === 'CLOSED'),
  };
}
