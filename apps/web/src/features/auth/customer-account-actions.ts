'use server';

import {
  CustomerSession,
  DealerWorkspacesResponse,
  type DealerWorkspace,
} from '@dealers-drive/contracts';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { apiGetParsed, apiSend, SESSION_COOKIE } from '@/lib/api';
import { maskIndianMobile } from '@/lib/person';

import { CUSTOMER_ACCOUNT_PATHS, DEALER_CONSOLE_HREF } from './customer-account-actions.constants';

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

export async function customerAccountAction(): Promise<CustomerAccount | null> {
  if (!(await cookies()).get(SESSION_COOKIE)?.value) return null;
  try {
    const [session, workspaces] = await Promise.all([
      apiGetParsed(CustomerSession, CUSTOMER_ACCOUNT_PATHS.me, { revalidate: false }),
      workspacesOf(),
    ]);
    return {
      fullName: session.customer.fullName,
      phoneMasked: maskIndianMobile(session.customer.phone),
      workspaces,
    };
  } catch {
    return null;
  }
}

export async function enterWorkspaceAction(membershipId: string): Promise<void> {
  await apiSend<unknown>('PUT', CUSTOMER_ACCOUNT_PATHS.currentWorkspace, { membershipId });
  redirect(DEALER_CONSOLE_HREF);
}

export async function customerLogoutAction(): Promise<void> {
  await apiSend<void>('POST', CUSTOMER_ACCOUNT_PATHS.logout).catch(() => undefined);
  (await cookies()).delete(SESSION_COOKIE);
}
