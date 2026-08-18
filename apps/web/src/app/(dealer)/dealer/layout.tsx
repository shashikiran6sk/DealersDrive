import type { DealerProfile } from '@dealers-drive/contracts';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import { ConsoleNav, ConsoleTabBar, DEALER_NAV } from '@/components/dealer/console-nav';
import { Blueprint, Plate, StatusTag } from '@/components/ui/primitives';
import { SignOutButton } from '@/features/auth/sign-out';
import { ApiError, apiGet } from '@/lib/api';
import { seoMetadata } from '@/lib/seo';
import { hasSession } from '@/lib/session';

/**
 * DESIGN-SPEC §3.11 — the dealer console shell.
 *
 * The dealer comes from `GET /v1/dealer`, which the API resolves from the
 * session — this layout never sends an id and there is no id in any URL below
 * it (Rule 1). Nothing here is cached: it is per-session data (§18).
 *
 * It is also the console's guard. A 401 from that one call means no valid
 * session, and every page beneath this layout is therefore unreachable without
 * one — the check is not repeated per page, so it cannot be forgotten on a new
 * page. Authorization itself still happens at the API on every request; this
 * only decides which screen a signed-out person sees.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: { default: 'Dealer console', template: '%s · Dealer console' },
  ...seoMetadata({ kind: 'private' }),
};

export default async function DealerLayout({ children }: { children: ReactNode }) {
  const dealer = await requireDealer();

  return (
    <div className="flex min-h-dvh bg-(--color-bg)">
      {/* Sidebar — 214px, white, right divider. */}
      <aside className="hidden w-[214px] flex-none flex-col gap-[18px] border-r border-(--color-divider) bg-white px-3 py-[18px] md:flex">
        <Link href="/" className="flex items-center gap-[9px] no-underline">
          <Plate size="logo">DD</Plate>
          <span className="font-heading text-[15px] font-semibold">Dealer console</span>
        </Link>

        <ConsoleNav items={DEALER_NAV} />

        <Blueprint className="mt-auto bg-(--color-accent-100) p-3">
          <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-(--color-accent-800)">
            Listing credits
          </div>
          <div className="my-1 font-heading text-[28px] font-bold leading-none tnum">
            {dealer.creditBalance}
          </div>
          {dealer.creditsHeld > 0 ? (
            <div className="mb-[6px] text-[11px] ink-subtle tnum">
              {dealer.creditsHeld} held for cars under review
            </div>
          ) : null}
          <Link href="/dealer/billing" className="btn btn-primary btn-block">
            Buy credits
          </Link>
        </Blueprint>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar — sticky, 58px, white, bottom divider. */}
        <header className="sticky top-0 z-[15] flex h-[58px] flex-none items-center gap-3 border-b border-(--color-divider) bg-white px-5">
          <span className="truncate font-heading text-[16px] font-semibold">
            {dealer.brandName}
          </span>
          <StatusTag tone={dealer.status === 'ACTIVE' ? 'accent' : 'warn'}>
            {dealer.statusLabel}
          </StatusTag>

          <span className="ml-auto whitespace-nowrap text-[12px] ink-muted tnum">
            {dealer.creditBalance} credits
          </span>
          <Link href="/dealer/vehicles/new" className="btn btn-primary">
            Add vehicle
          </Link>
          <SignOutButton />
        </header>

        <main className="min-w-0 flex-1 pb-[56px] md:pb-0">{children}</main>
      </div>

      <ConsoleTabBar items={DEALER_NAV} />
    </div>
  );
}

/**
 * The dealership on this session, or the sign-in screen.
 *
 * A signed-in person with no dealership yet gets onboarding rather than a
 * console with nothing in it — the API answers 401 for both cases, so the
 * distinction is made by `/v1/auth/me` on that page, not guessed here.
 */
async function requireDealer(): Promise<DealerProfile> {
  try {
    return await apiGet<DealerProfile>('/v1/dealer', { revalidate: false });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      // The API answers 401 for both "no session" and "signed in, but no
      // dealership yet", and deliberately does not distinguish them — that
      // would tell an unauthenticated caller which of the two it was. Here the
      // caller's own cookie settles it: someone carrying one is finishing
      // sign-up, not signed out. Onboarding re-checks with the API anyway, so a
      // dead cookie lands on sign-in one hop later.
      redirect((await hasSession()) ? '/dealer/onboarding' : '/dealer/login?error=session_expired');
    }
    throw error;
  }
}
