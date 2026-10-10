'use server';

import {
  DealerVerificationDecisionInput,
  IdParam,
  type DealerVerificationReview,
} from '@dealers-drive/contracts';
import { revalidatePath } from 'next/cache';
import { ApiError, apiSend } from '@/lib/api';
import { revalidatePublicDealer, revalidatePublicVehicles } from '@/lib/cache-tags';

export async function decideDealerVerification(
  dealerId: string,
  input: unknown,
): Promise<{ ok: true; review: DealerVerificationReview } | { ok: false; message: string }> {
  const id = IdParam.safeParse({ id: dealerId });
  const body = DealerVerificationDecisionInput.safeParse(input);
  if (!id.success || !body.success)
    return {
      ok: false,
      message: body.success
        ? 'Invalid dealership.'
        : (body.error.issues[0]?.message ?? 'Check the verification decision.'),
    };
  try {
    const review = await apiSend<DealerVerificationReview>(
      'POST',
      `/v1/admin/dealers/${id.data.id}/verification`,
      body.data,
    );
    revalidatePath(`/admin/dealers/${id.data.id}`);
    revalidatePublicDealer();
    revalidatePublicVehicles();
    return { ok: true, review };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof ApiError
          ? error.userMessage('Could not save the verification decision.')
          : 'Verification service is unavailable.',
    };
  }
}
