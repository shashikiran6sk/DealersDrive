'use server';

import { LegalAcceptInput, type LegalScope, type LegalStatus } from '@dealers-drive/contracts';
import { redirect } from 'next/navigation';

import { ApiError, apiSend } from '@/lib/api';
import { safeReturnPath } from '@/lib/url';

export async function acceptLegalAction(
  scope: LegalScope,
  returnTo: string,
  _previous: { message?: string },
  form: FormData,
): Promise<{ message?: string }> {
  const parsed = LegalAcceptInput.safeParse({ scope, accepted: form.get('accepted') === 'true' });
  if (!parsed.success) return { message: 'Select the checkbox to continue.' };
  try {
    await apiSend<LegalStatus>('POST', '/v1/legal/accept', parsed.data);
  } catch (error) {
    return {
      message:
        error instanceof ApiError
          ? error.userMessage()
          : 'The API is unavailable. Try again shortly.',
    };
  }
  redirect(safeReturnPath(returnTo, scope === 'DEALER' ? '/dealer' : '/'));
}
