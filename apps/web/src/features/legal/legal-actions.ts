'use server';
import { Uuid } from '@dealers-drive/contracts';
import { revalidatePath } from 'next/cache';
import { ApiError, apiSend } from '@/lib/api';
import { legalAccount } from './legal-account';
import { accountAgreement, dealerAgreement, listingDeclaration } from './legal-form-input';
export interface LegalActionState {
  message?: string;
  done?: boolean;
}
function failure(error: unknown): LegalActionState {
  return {
    message:
      error instanceof ApiError
        ? error.userMessage('Your choice could not be recorded.')
        : 'We could not record your choice. Please try again.',
  };
}
export async function acceptAccountAction(
  _previous: LegalActionState,
  form: FormData,
): Promise<LegalActionState> {
  const input = accountAgreement(form);
  if (!input.success)
    return { message: 'Accept the Terms and acknowledge the Privacy Policy to continue.' };
  try {
    const account = await legalAccount();
    if (!account) return { message: 'Sign in before recording an agreement.' };
    await apiSend('POST', `${account.base}/terms`, input.data);
    revalidatePath('/agreements');
    return {
      done: true,
      message: 'Your Terms acceptance and Privacy Policy acknowledgment have been recorded.',
    };
  } catch (error) {
    return failure(error);
  }
}
export async function acceptDealerAction(
  _previous: LegalActionState,
  form: FormData,
): Promise<LegalActionState> {
  const input = dealerAgreement(form);
  if (!input.success)
    return {
      message: 'Accept the agreements, acknowledge the Privacy Policy and confirm your authority.',
    };
  try {
    await apiSend('POST', '/v1/legal/dealer/dealer-agreement', input.data);
    revalidatePath('/agreements');
    revalidatePath('/dealer', 'layout');
    return {
      done: true,
      message: 'The dealership agreement and your authority declaration have been recorded.',
    };
  } catch (error) {
    return failure(error);
  }
}
export async function certifyAssistedAction(
  _previous: LegalActionState,
  form: FormData,
): Promise<LegalActionState> {
  const id = Uuid.safeParse(form.get('vehicleId'));
  const declaration = listingDeclaration(form);
  if (!id.success || !declaration.success)
    return { message: 'Review the assisted draft and confirm the declaration.' };
  try {
    await apiSend('POST', `/v1/dealer/vehicles/${id.data}/certify`, declaration.data);
    revalidatePath('/agreements');
    return {
      done: true,
      message:
        'This draft is certified for an assisted submission. Any edit requires a fresh certification.',
    };
  } catch (error) {
    return failure(error);
  }
}
export async function withdrawSharingAction(
  _previous: LegalActionState,
  form: FormData,
): Promise<LegalActionState> {
  const id = Uuid.safeParse(form.get('enquiryId'));
  if (!id.success) return { message: 'Select one of your enquiries.' };
  try {
    await apiSend('POST', `/v1/enquiries/${id.data}/withdraw-sharing`);
    revalidatePath('/data-rights');
    revalidatePath('/enquiries');
    return {
      done: true,
      message:
        'Future Platform disclosure to the dealership has stopped. Details already received cannot be recalled; contact support if you need further help.',
    };
  } catch (error) {
    return failure(error);
  }
}
