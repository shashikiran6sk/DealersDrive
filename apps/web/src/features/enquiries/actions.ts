'use server';

import {
  UpdateEnquiryInput,
  type UpdateEnquiryResponse,
} from '@dealers-drive/contracts';
import { revalidatePath } from 'next/cache';

import { ApiError, apiSend } from '@/lib/api';

export interface EnquiryUpdateResult {
  ok: boolean;
  message?: string;
  counts?: UpdateEnquiryResponse['counts'];
}

/**
 * C17 — the inbox lifecycle: NEW → CONTACTED → CLOSED, with SPAM and reopen
 * (ARCHITECTURE §14.3).
 *
 * The enquiry id is all the client sends. Which dealer owns it is the API's
 * business, resolved from the session, and an id belonging to another dealer
 * comes back 404 rather than being acted on (Rule 1, §5.2).
 */
export async function updateEnquiryStatusAction(
  enquiryId: string,
  input: unknown,
): Promise<EnquiryUpdateResult> {
  const parsed = UpdateEnquiryInput.safeParse(input);
  if (!parsed.success) return { ok: false, message: 'That is not a status this inbox has.' };

  try {
    const result = await apiSend<UpdateEnquiryResponse>(
      'PATCH',
      `/v1/dealer/enquiries/${enquiryId}`,
      parsed.data,
    );
    // The dashboard's "New enquiries" stat reads the same rows.
    revalidatePath('/dealer');
    return { ok: true, counts: result.counts };
  } catch (error) {
    if (error instanceof ApiError) {
      return { ok: false, message: error.userMessage(error.problem.title) };
    }
    return { ok: false, message: 'We could not update that enquiry. Try again.' };
  }
}
