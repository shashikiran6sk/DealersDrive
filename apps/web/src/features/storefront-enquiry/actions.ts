'use server';

import { CreateStorefrontEnquiryInput, type EnquiryReceipt } from '@dealers-drive/contracts';

import { ApiError, apiSend } from '@/lib/api';

export type WebsiteEnquiryState = {
  status: 'idle' | 'sent' | 'error';
  message?: string;
  receipt?: EnquiryReceipt;
};

export async function sendWebsiteEnquiryAction(
  ticket: string,
  _previous: WebsiteEnquiryState,
  formData: FormData,
): Promise<WebsiteEnquiryState> {
  const parsed = CreateStorefrontEnquiryInput.safeParse({
    ticket,
    message: formData.get('message') ?? undefined,
    consent: formData.get('consent') === 'on',
  });
  if (!parsed.success)
    return {
      status: 'error',
      message: 'Confirm consent and keep your message under 1,000 characters.',
    };
  try {
    const receipt = await apiSend<EnquiryReceipt>('POST', '/v1/enquiries/storefront', parsed.data);
    return { status: 'sent', receipt };
  } catch (error) {
    return {
      status: 'error',
      message:
        error instanceof ApiError
          ? error.userMessage()
          : 'The enquiry could not be sent. Please try again.',
    };
  }
}
