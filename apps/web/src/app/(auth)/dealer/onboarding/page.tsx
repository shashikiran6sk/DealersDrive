import type { AuthSession, CitiesResponse } from '@dealers-drive/contracts';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { AuthShell } from '@/components/auth/auth-shell';
import { OnboardingWizard } from '@/features/auth/onboarding-wizard';
import { ApiError, apiGet } from '@/lib/api';

/**
 * DESIGN-SPEC §3.10 — dealer onboarding.
 *
 * The screen a verified Google account lands on when it has no dealership yet,
 * and the screen a half-finished dealership returns to. Which of the four steps
 * it opens on is decided here, on the server, from the session — not from
 * anything the browser remembers.
 *
 * The email is never asked for. It arrived from Google, the API verified it,
 * and step 1 shows it as a read-only verified field.
 */
export const dynamic = 'force-dynamic';

/*
 * ── Reconstruction slice ────────────────────────────────────────────────────
 * The baseline spreads `seoMetadata({ kind: 'private' })` from `lib/seo.ts`
 * here. That file is the whole indexing policy in one function and belongs to
 * **F095**; what it resolves to for a `private` route is the literal below.
 * The same substitution was made at `(auth)/dealer/login/page.tsx` in F018,
 * for the same reason — an onboarding screen carrying a person's name, phone
 * and business details must be `noindex` from the day it exists.
 */
const PRIVATE_ROBOTS: Metadata['robots'] = { index: false, follow: false };

export const metadata: Metadata = {
  title: 'Set up your dealership',
  robots: PRIVATE_ROBOTS,
};

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ step?: string }>;
}) {
  const session = await session_();

  // A dealership that is DRAFT is still being set up, and one awaiting approval
  // still has a screen here — the "under review" panel that closes the wizard
  // (DESIGN-SPEC §3.10 step 4). Anything else belongs in the console.
  if (session.dealer && !['DRAFT', 'PENDING_APPROVAL'].includes(session.dealer.status)) {
    redirect('/dealer');
  }

  /*
   * ── Reconstruction slice ──────────────────────────────────────────────────
   * The baseline fetches four things here. `/v1/cities` arrives now, with the
   * Business step that reads it; `/v1/dealer/documents` and `/v1/dealer` come
   * with **F041** and `/v1/dealer/completeness` with **F042**, each with the
   * step body that reads it. Fetching one earlier would be a request per page
   * load feeding nothing.
   *
   * The baseline also makes the last three conditional on a dealership
   * existing, in one `Promise.all` beside this. That shape returns when there
   * is more than one thing to fetch — `/v1/cities` is not dealership-scoped
   * (steps 1 and 2 run before a dealership exists), so on its own it is a
   * single await.
   *
   * `/v1/auth/me` is not one of the four: it is what places a dealer on a step
   * at all, and the Account step (**F038**) shows the Google identity it
   * carries rather than asking for it.
   * ──────────────────────────────────────────────────────────────────────────
   */
  const cities = await apiGet<CitiesResponse>('/v1/cities', { revalidate: 3600 });

  const requested = Number((await searchParams).step ?? NaN);
  // The dealership decides the floor: steps 1 and 2 create it, so they are
  // behind you once it exists, and steps 3 and 4 need it to exist at all. Once
  // it is submitted, only the last step is left.
  const floor = session.dealer?.status === 'PENDING_APPROVAL' ? 3 : session.dealer ? 2 : 0;
  const step = Number.isFinite(requested) ? Math.min(3, Math.max(floor, requested)) : floor;

  return (
    <AuthShell>
      <OnboardingWizard step={step as 0 | 1 | 2 | 3} session={session} cities={cities.data} />
    </AuthShell>
  );
}

/** The session, or the sign-in screen. A 401 here is a redirect, not an error page. */
async function session_(): Promise<AuthSession> {
  try {
    return await apiGet<AuthSession>('/v1/auth/me', { revalidate: false });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      redirect('/dealer/login?error=session_expired');
    }
    throw error;
  }
}
