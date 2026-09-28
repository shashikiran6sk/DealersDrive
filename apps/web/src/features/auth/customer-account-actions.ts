'use server';

import { CustomerSession } from '@dealers-drive/contracts';
import { cookies } from 'next/headers';

import { apiGetParsed, apiSend, SESSION_COOKIE } from '@/lib/api';

import { CUSTOMER_ACCOUNT_PATHS } from './customer-account-actions.constants';

export interface CustomerAccount {
  fullName: string;
}

export async function customerAccountAction(): Promise<CustomerAccount | null> {
  if (!(await cookies()).get(SESSION_COOKIE)?.value) return null;
  try {
    const session = await apiGetParsed(CustomerSession, CUSTOMER_ACCOUNT_PATHS.me, {
      revalidate: false,
    });
    return { fullName: session.customer.fullName };
  } catch {
    return null;
  }
}

export async function customerLogoutAction(): Promise<void> {
  await apiSend<void>('POST', CUSTOMER_ACCOUNT_PATHS.logout).catch(() => undefined);
  (await cookies()).delete(SESSION_COOKIE);
}
