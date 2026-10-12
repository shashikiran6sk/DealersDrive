import { AdminPortfolioQueue, PortfolioModerationQuery } from '@dealers-drive/contracts';
import type { Metadata } from 'next';

import { EmptyState } from '@/components/ui/primitives';
import {
  PORTFOLIO_MODERATION_TEXT,
  PortfolioModerationQueue,
} from '@/features/admin/portfolio-moderation';
import { ApiError, apiGetParsed, qs } from '@/lib/api';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: PORTFOLIO_MODERATION_TEXT.title };

type SearchParamsInput = Record<string, string | string[] | undefined>;

function one(params: SearchParamsInput, key: string): string | undefined {
  const value = params[key];
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;
}

export default async function AdminPortfolioPage({
  searchParams,
}: {
  searchParams: Promise<SearchParamsInput>;
}) {
  const params = await searchParams;
  const parsed = PortfolioModerationQuery.safeParse({ status: one(params, 'status') });
  const status = parsed.success ? parsed.data.status : 'PENDING';

  let queue: AdminPortfolioQueue;
  try {
    queue = await apiGetParsed(AdminPortfolioQueue, `/v1/admin/portfolio${qs({ status })}`, {
      revalidate: false,
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 403) {
      return (
        <div className="p-5">
          <EmptyState
            title={PORTFOLIO_MODERATION_TEXT.forbiddenTitle}
            message={PORTFOLIO_MODERATION_TEXT.forbiddenMessage}
          />
        </div>
      );
    }
    throw error;
  }

  return (
    <div className="p-5">
      <PortfolioModerationQueue queue={queue} status={status} />
    </div>
  );
}
