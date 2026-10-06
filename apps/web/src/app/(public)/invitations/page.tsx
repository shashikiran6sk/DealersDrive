import { MyInvitationsResponse } from '@dealers-drive/contracts';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { INVITATION_PATHS, INVITATIONS_TEXT, InvitationList } from '@/features/invitations';
import { ApiError, apiGetParsed } from '@/lib/api';
import { seoMetadata } from '@/lib/seo';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: INVITATIONS_TEXT.title,
  ...seoMetadata({ kind: 'private' }),
};

export default async function InvitationsPage() {
  let invitations: MyInvitationsResponse;
  try {
    invitations = await apiGetParsed(MyInvitationsResponse, INVITATION_PATHS.mine, {
      revalidate: false,
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) redirect(INVITATIONS_TEXT.loginPath);
    throw error;
  }

  return (
    <div className="mx-auto w-full max-w-[760px] px-4 pt-[22px] pb-[60px] sm:px-6">
      <InvitationList invitations={invitations.data} />
    </div>
  );
}
