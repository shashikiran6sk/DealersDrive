import { SavedVehiclesResponse } from '@dealers-drive/contracts';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { SAVED_LIST_TEXT, SAVED_PAGE_LIMIT, SavedList } from '@/features/saved/saved-list';
import { ApiError, apiGetParsed, qs } from '@/lib/api';
import { seoMetadata } from '@/lib/seo';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: SAVED_LIST_TEXT.title,
  ...seoMetadata({ kind: 'private' }),
};

type SearchParamsInput = Record<string, string | string[] | undefined>;

const LOGIN_TO_SEE = `/login?returnTo=${encodeURIComponent('/saved')}`;

export default async function SavedCarsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParamsInput>;
}) {
  const params = await searchParams;
  const cursor = typeof params.cursor === 'string' ? params.cursor : undefined;

  let saved: SavedVehiclesResponse;
  try {
    saved = await apiGetParsed(
      SavedVehiclesResponse,
      `/v1/saved-vehicles${qs({ cursor, limit: SAVED_PAGE_LIMIT })}`,
      { revalidate: false },
    );
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) redirect(LOGIN_TO_SEE);
    throw error;
  }

  return (
    <div className="mx-auto w-full max-w-[1280px] px-4 pt-[22px] pb-[60px] sm:px-6">
      <SavedList saved={saved} />
    </div>
  );
}
