import type { DealerProfile } from '@dealers-drive/contracts';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import { ConsoleNav, ConsoleTabBar, LANDED_NAV } from '@/components/dealer/console-nav';
import { Blueprint, Plate, StatusTag } from '@/components/ui/primitives';
import { SignOutButton } from '@/features/auth/sign-out';
import { apiGet } from '@/lib/api';
import { currentSession } from '@/lib/session';

/**
 * DESIGN-SPEC §3.11 — the dealer console shell.
 *
 * The dealer comes from `GET /v1/dealer`, which the API resolves from the
 * session — this layout never sends an id and there is no id in any URL below
 * it (Rule 1). Nothing here is cached: it is per-session data (§18).
 *
 * It is also the console's guard, and that is the half worth reading. A page
 * beneath this layout is unreachable without a dealership, and the check is not
 * repeated per page, so it cannot be forgotten on a new one. Authorization
 * itself still happens at the API on every request; this only decides which
 * screen a signed-out person sees.
 */
export const dynamic = 'force-dynamic';

/*
 * ── Reconstruction slice ────────────────────────────────────────────────────
 * The baseline spreads `seoMetadata({ kind: 'private' })` from `lib/seo.ts`
 * here. That file exists but its `private` arm belongs to **F095**; what it
 * resolves to for a private route is the literal below. The same substitution
 * was made at the admin shell, at both sign-in screens and at the onboarding
 * wizard — an authenticated console must be `noindex` from the day it exists.
 * ────────────────────────────────────────────────────────────────────────────
 */
const PRIVATE_ROBOTS: Metadata['robots'] = { index: false, follow: false };

export const metadata: Metadata = {
  title: { default: 'Dealer console', template: '%s · Dealer console' },
  robots: PRIVATE_ROBOTS,
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

        <ConsoleNav items={LANDED_NAV} />

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
          {/*
            ── Reconstruction slice ──────────────────────────────────────────
            The baseline's `Buy credits` button links to `/dealer/billing`,
            which arrives with **F051**. The balance itself is real — it is on
            `DealerProfile` and this layout already has it — so the panel stays
            and the button is what waits, rather than the whole card. A dealer
            reading their own balance is the panel's first job; buying is the
            second, and a button onto a 404 does neither.
            ─────────────────────────────────────────────────────────────────
          */}
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
          {/*
            The baseline's `Add vehicle` button sits here, onto
            `/dealer/vehicles/new` — the wizard, **F056**. Held back with the
            nav item that points at the same route.
          */}
          <SignOutButton />
        </header>

        <main className="min-w-0 flex-1 pb-[56px] md:pb-0">{children}</main>
      </div>

      <ConsoleTabBar items={LANDED_NAV} />
    </div>
  );
}

/**
 * The dealership on this session, or the screen this visitor belongs on.
 *
 * `GET /v1/dealer` answers 401 to two quite different visitors and deliberately
 * does not distinguish them — that would tell an unauthenticated caller which
 * of the two it was. So the question is asked of `/v1/auth/me` first, which is
 * answering about the caller's own session and may therefore say:
 *
 *   · nobody signed in at all → the sign-in screen;
 *   · signed in, no dealership yet → the onboarding wizard, because there is no
 *     console to show until there is a dealership.
 *
 * ── Reconstruction slice ────────────────────────────────────────────────────
 * This guard was written on `(dealer)/dealer/profile/page.tsx` at **F046**,
 * with a note saying **F047 should lift it here** once one route stopped being
 * the whole segment. That is what has happened: it is on the layout now, the
 * page has none, and a console page added later inherits it rather than
 * remembering to repeat it.
 *
 * The baseline asks `hasSession()` — a cookie is present — and catches the 401
 * from `/v1/dealer`. The cheaper question is the weaker one: a cookie that
 * exists but no longer works would land on onboarding, which would bounce it
 * back here. `currentSession()` costs one call and cannot loop.
 * ────────────────────────────────────────────────────────────────────────────
 */
async function requireDealer(): Promise<DealerProfile> {
  const session = await currentSession();
  if (!session) redirect('/dealer/login?error=session_expired');
  if (session.next === 'ONBOARDING') redirect('/dealer/onboarding');

  return apiGet<DealerProfile>('/v1/dealer', { revalidate: false });
}
