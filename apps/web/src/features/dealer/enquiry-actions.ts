'use server';

import { IdParam, UpdateEnquiryInput, type DealerEnquiry } from '@dealers-drive/contracts';
import { revalidatePath } from 'next/cache';

import { ApiError, apiSend } from '@/lib/api';

import { ENQUIRY_ACTION_TEXT } from './enquiry-actions.constants';

export type EnquiryStatusResult = { ok: true } | { ok: false; message: string };

export async function setEnquiryStatusAction(
  enquiryId: string,
  status: string,
): Promise<EnquiryStatusResult> {
  const id = IdParam.safeParse({ id: enquiryId });
  const body = UpdateEnquiryInput.safeParse({ status });
  if (!id.success || !body.success) return { ok: false, message: ENQUIRY_ACTION_TEXT.invalid };

  try {
    await apiSend<DealerEnquiry>(
      'PATCH',
      `/v1/dealer/enquiries/${encodeURIComponent(id.data.id)}`,
      body.data,
    );
  } catch (error) {
    if (error instanceof ApiError) {
      return { ok: false, message: error.userMessage(ENQUIRY_ACTION_TEXT.failed) };
    }
    return { ok: false, message: ENQUIRY_ACTION_TEXT.unavailable };
  }

  revalidatePath(ENQUIRY_ACTION_TEXT.inboxPath);
  return { ok: true };
}
