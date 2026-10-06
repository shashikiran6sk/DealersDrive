'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { apiSend, SESSION_COOKIE } from '@/lib/api';
import { writeAuthHint } from '@/lib/auth-hint-cookie';

import { lookupCustomerAccount, type CustomerAccount } from './customer-account';
import { CUSTOMER_ACCOUNT_PATHS, DEALER_CONSOLE_HREF } from './customer-account-actions.constants';

export async function customerAccountAction(): Promise<CustomerAccount | null> {
  const lookup = await lookupCustomerAccount();
  return lookup.status === 'signed-in' ? lookup.account : null;
}

export async function enterWorkspaceAction(membershipId: string): Promise<void> {
  await apiSend<unknown>('PUT', CUSTOMER_ACCOUNT_PATHS.currentWorkspace, { membershipId });
  redirect(DEALER_CONSOLE_HREF);
}

export async function customerLogoutAction(): Promise<void> {
  await apiSend<void>('POST', CUSTOMER_ACCOUNT_PATHS.logout).catch(() => undefined);
  (await cookies()).delete(SESSION_COOKIE);
  await writeAuthHint(false);
}
