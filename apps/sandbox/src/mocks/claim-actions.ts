import type { DealerClaimPreview } from '@dealers-drive/contracts';

import type { PhoneVerificationState } from '@/features/auth/phone-actions';

export const claimActionStub: { delayMs: number; calls: string[] } = {
  delayMs: 600,
  calls: [],
};

async function wait(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, claimActionStub.delayMs));
}

export async function confirmClaimEmailAction(
  token: string,
): Promise<{ preview?: DealerClaimPreview; error?: string }> {
  claimActionStub.calls.push(`confirm ${token}`);
  await wait();
  return {
    preview: {
      state: 'AWAITING_CLAIM',
      dealerName: 'Claimable Motors',
      city: 'Katpadi',
      district: 'Vellore',
      emailMasked: 's••••@gmail.com',
      phoneMasked: '+91 ••••• •2345',
      phoneLast4: '2345',
      assistedBy: 'Arun',
      expiresAt: '2026-10-09T10:00:00.000Z',
    },
  };
}

export async function claimDealershipAction(
  token: string,
  phone: string,
): Promise<PhoneVerificationState> {
  claimActionStub.calls.push(`claim ${token} ${phone}`);
  await wait();
  return { verified: true, returnTo: '/dealer' };
}
