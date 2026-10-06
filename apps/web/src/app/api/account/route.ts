import { NextResponse } from 'next/server';

import { writeAuthHint } from '@/lib/auth-hint-cookie';
import { lookupCustomerAccount } from '@/features/auth/customer-account';

const PRIVATE_NO_STORE = { 'Cache-Control': 'private, no-store' } as const;

export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  const lookup = await lookupCustomerAccount();

  if (lookup.status === 'unavailable') {
    return NextResponse.json({ status: lookup.status }, { status: 503, headers: PRIVATE_NO_STORE });
  }

  await writeAuthHint(lookup.status === 'signed-in');
  return NextResponse.json(lookup, { headers: PRIVATE_NO_STORE });
}
