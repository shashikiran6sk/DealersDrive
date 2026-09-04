import type {
  AuthSession,
  CitiesResponse,
  DealerDocumentsResponse,
  DealerProfile,
} from '@dealers-drive/contracts';
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
   * Three of the baseline's four fetches. `/v1/dealer/completeness` arrives
   * with **F042**, the step that reads it.
   * ──────────────────────────────────────────────────────────────────────────
   */
  // The last two are dealership-scoped, so they exist only once one does.
  const [cities, documents, dealer] = await Promise.all([
    apiGet<CitiesResponse>('/v1/cities', { revalidate: 3600 }),
    session.dealer
      ? apiGet<DealerDocumentsResponse>('/v1/dealer/documents', { revalidate: false })
      : Promise.resolve(null),
    session.dealer
      ? apiGet<DealerProfile>('/v1/dealer', { revalidate: false })
      : Promise.resolve(null),
  ]);

  const requested = Number((await searchParams).step ?? NaN);
  // The dealership decides the floor: steps 1 and 2 create it, so they are
  // behind you once it exists, and steps 3 and 4 need it to exist at all. Once
  // it is submitted, only the last step is left.
  const floor = session.dealer?.status === 'PENDING_APPROVAL' ? 3 : session.dealer ? 2 : 0;
  const step = Number.isFinite(requested) ? Math.min(3, Math.max(floor, requested)) : floor;

  return (
    <AuthShell>
      <OnboardingWizard
        step={step as 0 | 1 | 2 | 3}
        session={session}
        cities={cities.data}
        documents={documents?.data ?? []}
        dealer={dealer}
      />
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
