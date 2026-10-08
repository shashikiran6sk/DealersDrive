'use server';

import {
  CreateEnquiryInput,
  CustomerSession,
  type EnquirySharingPermission,
  type EnquiryReceipt,
} from '@dealers-drive/contracts';

import { cookies } from 'next/headers';

import { legalEnforcementEnabled } from '@/lib/legal-release';
import { ApiError, apiGetParsed, apiSend, SESSION_COOKIE } from '@/lib/api';

import { ENQUIRY_ACTION_TEXT } from './actions.constants';

export interface EnquiryCustomer {
  fullName: string;
  phoneDisplay: string;
}

export type SendEnquiryState =
  | { status: 'sent'; receipt: EnquiryReceipt }
  | { status: 'signed-out' }
  | { status: 'refused'; code: string; message: string }
  | { status: 'invalid'; message: string };

export async function enquiryCustomerAction(): Promise<EnquiryCustomer | null> {
  if (!(await cookies()).get(SESSION_COOKIE)?.value) return null;
  try {
    const session = await apiGetParsed(CustomerSession, '/v1/auth/customer/me', {
      revalidate: false,
    });
    return {
      fullName: session.customer.fullName,
      phoneDisplay: session.customer.phoneDisplay,
    };
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
}

export async function sendEnquiryAction(
  listingSlug: string,
  message: string,
  sharing?: EnquirySharingPermission,
): Promise<SendEnquiryState> {
  if (sharing && !legalEnforcementEnabled())
    return {
      status: 'invalid',
      message: 'Sharing collection has changed. Refresh before continuing.',
    };
  if (legalEnforcementEnabled() && !sharing?.granted)
    return { status: 'invalid', message: 'Choose whether to share your details before sending.' };
  const parsed = CreateEnquiryInput.safeParse({
    listingSlug,
    message,
    ...(legalEnforcementEnabled() ? { sharing } : {}),
  });
  if (!parsed.success) {
    return {
      status: 'invalid',
      message: parsed.error.issues[0]?.message ?? ENQUIRY_ACTION_TEXT.invalid,
    };
  }

  try {
    const receipt = await apiSend<EnquiryReceipt>('POST', '/v1/enquiries', parsed.data);
    return { status: 'sent', receipt };
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.status === 401) return { status: 'signed-out' };
      return {
        status: 'refused',
        code: error.code,
        message: error.userMessage(ENQUIRY_ACTION_TEXT.failed),
      };
    }
    return { status: 'refused', code: 'UNAVAILABLE', message: ENQUIRY_ACTION_TEXT.unavailable };
  }
}
