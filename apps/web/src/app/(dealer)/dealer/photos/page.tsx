import { canDealer, DealerPortfolioResponse } from '@dealers-drive/contracts';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { PORTFOLIO_TEXT, PortfolioManager } from '@/features/dealer/portfolio-manager';
import { apiGetParsed } from '@/lib/api';
import { currentSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

const DEALER_HOME = '/dealer';

export const metadata: Metadata = { title: PORTFOLIO_TEXT.title };

export default async function DealerPhotosPage() {
  const session = await currentSession();
  if (!canDealer(session?.permissions, 'dealer:update')) redirect(DEALER_HOME);

  const portfolio = await apiGetParsed(DealerPortfolioResponse, '/v1/dealer/portfolio', {
    revalidate: false,
  });

  return (
    <div className="px-4 py-[22px] md:px-8 md:py-[30px]">
      <PortfolioManager portfolio={portfolio} />
    </div>
  );
}
