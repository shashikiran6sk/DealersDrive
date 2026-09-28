import { redirect } from 'next/navigation';

import { one, type SearchParamsInput } from '@/lib/url';

export const dynamic = 'force-dynamic';

const CARRIED = ['error', 'returnTo'] as const;

export default async function DealerLoginPage({
  searchParams,
}: {
  searchParams: Promise<SearchParamsInput>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams({ as: 'dealer' });
  for (const key of CARRIED) {
    const value = one(params, key);
    if (value) query.set(key, value);
  }
  redirect(`/login?${query.toString()}`);
}
