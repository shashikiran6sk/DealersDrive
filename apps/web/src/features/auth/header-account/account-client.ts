import { z } from 'zod';

import type { CustomerAccount } from '@/features/auth/customer-account-actions';

import { ACCOUNT_ENDPOINT, ACCOUNT_TIMEOUT_MS } from './header-account.constants';

export type AccountLoader = (signal: AbortSignal) => Promise<CustomerAccount | null>;

const AccountLookupBody = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('signed-in'),
    account: z.object({
      fullName: z.string(),
      phoneMasked: z.string(),
      workspaces: z
        .array(
          z.object({
            membershipId: z.string(),
            brandName: z.string(),
            roleLabel: z.string(),
            enterable: z.boolean(),
            current: z.boolean(),
          }),
        )
        .optional(),
      invitations: z.number().optional(),
    }),
  }),
  z.object({ status: z.literal('signed-out') }),
]);

export const fetchCustomerAccount: AccountLoader = async (signal) => {
  const response = await fetch(ACCOUNT_ENDPOINT, {
    cache: 'no-store',
    credentials: 'same-origin',
    signal: AbortSignal.any([signal, AbortSignal.timeout(ACCOUNT_TIMEOUT_MS)]),
  });
  if (!response.ok) throw new Error(`account lookup failed: ${String(response.status)}`);
  const body = AccountLookupBody.parse(await response.json());
  return body.status === 'signed-in' ? body.account : null;
};
