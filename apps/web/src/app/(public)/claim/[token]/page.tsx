import type { DealerClaimPreview, PhoneOtpWidget } from '@dealers-drive/contracts';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { ClaimDealership } from '@/features/claim/claim-dealership';
import { ApiError, apiGet } from '@/lib/api';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Claim your dealership',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

async function widgetOrNull(): Promise<PhoneOtpWidget | null> {
  try {
    return await apiGet<PhoneOtpWidget>('/v1/auth/sign-in/phone/widget', { revalidate: false });
  } catch {
    return null;
  }
}

export default async function ClaimPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let preview: DealerClaimPreview;
  try {
    preview = await apiGet<DealerClaimPreview>(`/v1/dealer-claims/${encodeURIComponent(token)}`, {
      revalidate: false,
    });
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 400)) notFound();
    throw error;
  }

  return <ClaimDealership token={token} preview={preview} widget={await widgetOrNull()} />;
}
