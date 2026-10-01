import { canDealer, DealerTeamResponse } from '@dealers-drive/contracts';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { TEAM_TEXT, TeamPanel } from '@/features/dealer/team';
import { apiGetParsed } from '@/lib/api';
import { currentSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

const DEALER_HOME = '/dealer';

export const metadata: Metadata = { title: TEAM_TEXT.title };

export default async function TeamPage() {
  const session = await currentSession();
  if (!canDealer(session?.permissions, 'member:manage')) redirect(DEALER_HOME);

  const team = await apiGetParsed(DealerTeamResponse, '/v1/dealer/team', { revalidate: false });

  return (
    <div className="px-4 py-[22px] md:px-8 md:py-[30px]">
      <TeamPanel team={team} />
    </div>
  );
}
