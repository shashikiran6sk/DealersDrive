'use server';

import {
  CustomerDeactivationInput,
  CustomerSession,
  Uuid,
  CustomerDeactivationReceipt,
  CustomerDeletionRequestInput,
  CreateSupportTicketInput,
  CustomerSupportTicket,
  CUSTOMER_ACCOUNT_TEXT,
} from '@dealers-drive/contracts';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { ApiError, apiSend, apiGetParsed, SESSION_COOKIE } from '@/lib/api';
import { writeAuthHint } from '@/lib/auth-hint-cookie';

export async function deactivateCustomerAction(
  confirmed: boolean,
  expectedAccountId: string,
): Promise<{ done?: boolean; error?: string; reauth?: boolean }> {
  const parsed = CustomerDeactivationInput.safeParse({ confirmed });
  if (!parsed.success) return { error: CUSTOMER_ACCOUNT_TEXT.agree };
  try {
    if (
      !Uuid.safeParse(expectedAccountId).success ||
      (await apiGetParsed(CustomerSession, '/v1/auth/customer/me', { revalidate: false })).customer
        .id !== expectedAccountId
    )
      return { error: CUSTOMER_ACCOUNT_TEXT.changedAccount };
    CustomerDeactivationReceipt.parse(
      await apiSend<unknown>('POST', '/v1/auth/customer/account/deactivate', parsed.data),
    );
    (await cookies()).delete(SESSION_COOKIE);
    await writeAuthHint(false);
    revalidatePath('/', 'layout');
    return { done: true };
  } catch (error) {
    return {
      error:
        error instanceof ApiError
          ? error.userMessage(CUSTOMER_ACCOUNT_TEXT.failed)
          : CUSTOMER_ACCOUNT_TEXT.uncertain,
      reauth: error instanceof ApiError && error.code === 'CUSTOMER_REAUTH_REQUIRED',
    };
  }
}
export async function requestCustomerDeletionAction(
  draft: unknown,
): Promise<{ reference?: string; error?: string }> {
  const parsed = CustomerDeletionRequestInput.safeParse(draft);
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? CUSTOMER_ACCOUNT_TEXT.agree };
  const input = CreateSupportTicketInput.parse({
    category: 'ACCOUNT_ISSUE',
    subject: CUSTOMER_ACCOUNT_TEXT.deletionSubject,
    description: `${CUSTOMER_ACCOUNT_TEXT.deletionDescription}${parsed.data.message ? `\n\n${parsed.data.message}` : ''}`,
    clientRequestId: parsed.data.clientRequestId,
  });
  try {
    if (
      (await apiGetParsed(CustomerSession, '/v1/auth/customer/me', { revalidate: false })).customer
        .id !== parsed.data.expectedAccountId
    )
      return { error: CUSTOMER_ACCOUNT_TEXT.changedAccount };
    const ticket = CustomerSupportTicket.parse(
      await apiSend<unknown>('POST', '/v1/support/tickets', input),
    );
    revalidatePath('/support-requests');
    return { reference: ticket.reference };
  } catch (error) {
    return {
      error:
        error instanceof ApiError
          ? error.userMessage(CUSTOMER_ACCOUNT_TEXT.failed)
          : CUSTOMER_ACCOUNT_TEXT.failed,
    };
  }
}
