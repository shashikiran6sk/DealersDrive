import 'server-only';

import {
  CustomerSession,
  DealerWorkspacesResponse,
  MyInvitationsResponse,
  type DealerWorkspace,
} from '@dealers-drive/contracts';
import { cookies } from 'next/headers';

import { ApiError, apiGetParsed, SESSION_COOKIE } from '@/lib/api';
import { maskIndianMobile } from '@/lib/person';

import { CUSTOMER_ACCOUNT_PATHS } from './customer-account-actions.constants';

export interface AccountWorkspace {
  membershipId: string;
  brandName: string;
  roleLabel: string;
  enterable: boolean;
  current: boolean;
}

export interface CustomerAccount {
  fullName: string;
  phoneMasked: string;
  workspaces?: AccountWorkspace[];
  invitations?: number;
}

function toWorkspace(workspace: DealerWorkspace): AccountWorkspace {
  return {
    membershipId: workspace.membershipId,
    brandName: workspace.dealer.brandName,
    roleLabel: workspace.roleLabel,
    enterable: workspace.enterable,
    current: workspace.current,
  };
}

async function workspacesOf(): Promise<AccountWorkspace[]> {
  try {
    const list = await apiGetParsed(DealerWorkspacesResponse, CUSTOMER_ACCOUNT_PATHS.workspaces, {
      revalidate: false,
    });
    return list.data.map(toWorkspace);
  } catch {
    return [];
  }
}

async function invitationCount(): Promise<number> {
  try {
    const list = await apiGetParsed(MyInvitationsResponse, CUSTOMER_ACCOUNT_PATHS.invitations, {
      revalidate: false,
    });
    return list.data.length;
  } catch {
    return 0;
  }
}

export type CustomerAccountLookup =
  | { status: 'signed-in'; account: CustomerAccount }
  | { status: 'signed-out' }
  | { status: 'unavailable' };

export async function lookupCustomerAccount(): Promise<CustomerAccountLookup> {
  if (!(await cookies()).get(SESSION_COOKIE)?.value) return { status: 'signed-out' };
  try {
    const [session, workspaces, invitations] = await Promise.all([
      apiGetParsed(CustomerSession, CUSTOMER_ACCOUNT_PATHS.me, { revalidate: false }),
      workspacesOf(),
      invitationCount(),
    ]);
    return {
      status: 'signed-in',
      account: {
        fullName: session.customer.fullName,
        phoneMasked: maskIndianMobile(session.customer.phone),
        workspaces,
        invitations,
      },
    };
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return { status: 'signed-out' };
    return { status: 'unavailable' };
  }
}
